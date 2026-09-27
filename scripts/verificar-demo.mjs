import { chromium } from 'playwright'
// Percorre o roteiro de demonstração inteiro num navegador de verdade, em duas
// abas (analista e fiscal), e confere que cada passo faz o que promete.
// Requer o dev server rodando:  npm run dev -- --port 5199
const B = process.env.BASE_URL ?? 'http://localhost:5199'
let falhas = 0
const check = (nome, ok, extra = '') => {
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`)
  if (!ok) falhas++
}
const num = (t) => Number(String(t).match(/-?\d+/)[0])

const browser = await chromium.launch()
const erros = []
// Uma só janela do navegador: as duas abas compartilham localStorage e
// BroadcastChannel, exatamente como na apresentação.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } })

async function aba(userId, mobile = false) {
  const p = await ctx.newPage()
  p.on('pageerror', (e) => erros.push('pageerror: ' + e.message))
  p.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
  if (mobile) await p.setViewportSize({ width: 390, height: 844 })
  await p.goto(B)
  await p.evaluate((u) => sessionStorage.setItem('patio-check:usuario', u), userId)
  return p
}

// zera a demo para a execução ser reproduzível
const zero = await ctx.newPage()
await zero.goto(B)
await zero.evaluate(() => localStorage.clear())
await zero.close()

const an = await aba('u-analista-1')
const fi = await aba('u-fiscal-1', true)

// --- 1. Importar planilha: prévia valida antes de gravar
await an.goto(B + '/escala')
await an.waitForTimeout(900)
const contador = an.locator('section', { hasText: 'Drivers escalados' }).locator('text=/^\\d+ drivers$/').first()
const antesImport = num(await contador.innerText())

const csv = await (await fetch(B + '/escala-exemplo.csv')).text()
await an.setInputFiles('input[type=file]', {
  name: 'escala-exemplo.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
})
await an.waitForTimeout(600)
check('prévia mostra 7 linhas prontas', await an.locator('text=7 prontas').isVisible())
check('prévia recusa 1 linha com erro', await an.locator('text=1 com erro').isVisible())
check('erro aponta a linha 8 da planilha', (await an.locator('text=linha 8').count()) > 0)
check('nada é gravado antes de confirmar', num(await contador.innerText()) === antesImport)

await an.getByRole('button', { name: /Importar 7 drivers/ }).click()
await an.waitForTimeout(700)
const depoisImport = num(await contador.innerText())
check('importação soma exatamente as 7 linhas válidas', depoisImport === antesImport + 7,
  `${antesImport} → ${depoisImport}`)

// --- 2. Fiscal confere um driver; a aba do analista fica aberta o tempo todo
await an.goto(B + '/painel')
await an.waitForTimeout(800)
const conferidosKpi = an.locator('dt:text-is("Conferidos") + dd')
const conferidos0 = num(await conferidosKpi.innerText())

await fi.goto(B + '/patio')
await fi.waitForTimeout(900)
const chipPendentes = fi.getByRole('button', { name: /^Pendentes/i })
const pendentes0 = num(await chipPendentes.innerText())
const chipTodos = fi.getByRole('button', { name: /^Todos/i })
check('fiscal vê a escala completa na aba Todos',
  await chipTodos.getAttribute('aria-pressed') === 'true'
    && await fi.locator('ul > li').count() === num(await chipTodos.innerText()))
await chipPendentes.click()
await fi.locator('ul > li a').first().click()
await fi.waitForTimeout(400)
await fi.getByRole('button', { name: 'Tudo certo' }).click()
await fi.waitForTimeout(700)
check('check-in conforme tira o driver dos pendentes',
  num(await chipPendentes.innerText()) === pendentes0 - 1, `${pendentes0} → ${num(await chipPendentes.innerText())}`)

// --- 3. O painel do analista reage sozinho, sem recarregar
await an.waitForTimeout(1500)
const conferidos1 = num(await conferidosKpi.innerText())
check('painel do analista atualiza sozinho, sem recarregar', conferidos1 === conferidos0 + 1,
  `${conferidos0} → ${conferidos1}`)

// --- 4. Fiscal reporta placa adulterada pelo atalho
await fi.goto(B + '/patio')
await fi.waitForTimeout(700)
await fi.locator('ul > li a').first().click()
await fi.waitForTimeout(400)
const nomeBloqueado = (await fi.locator('h1').innerText()).trim()
const placaEsperada = (await fi.locator('[aria-label^="Placa "]').last().getAttribute('aria-label')).replace('Placa ', '')
await fi.getByRole('button', { name: 'Reportar divergência' }).click()
await fi.waitForTimeout(400)
const placaFalsa = placaEsperada.slice(0, 4) + (placaEsperada[4] === 'X' ? 'Y' : 'X') + placaEsperada.slice(5)
await fi.locator('#placa-encontrada').fill(placaFalsa)
await fi.waitForTimeout(400)
check('comparação destaca só o caractere que mudou',
  (await fi.locator('span.bg-sinal.text-white').count()) === 1, `${placaEsperada} vs ${placaFalsa}`)
await fi.getByRole('button', { name: 'Reportar e bloquear' }).click()
await fi.waitForTimeout(800)

// --- 5. O alerta sobe ao vivo no painel do analista
await an.waitForTimeout(1500)
check('alerta chega ao vivo no feed do analista',
  await an.locator(`text=${nomeBloqueado}`).first().isVisible())
check('driver entra na contagem de bloqueados',
  num(await an.locator('dt:text-is("Bloqueados") + dd').innerText()) >= 1)

// --- 6. Fiscal não desbloqueia
await fi.goto(B + '/patio')
await fi.waitForTimeout(700)
await fi.getByRole('button', { name: /^Bloqueados/i }).click()
await fi.waitForTimeout(500)
const cardBloqueado = fi.locator('ul > li a').filter({ hasText: nomeBloqueado }).first()
check('driver reportado aparece na aba Bloqueados', await cardBloqueado.isVisible())
await cardBloqueado.click()
await fi.waitForTimeout(500)
check('fiscal não tem botão de liberar em item bloqueado',
  (await fi.getByRole('button', { name: 'Tudo certo' }).count()) === 0)
check('tela diz que só analista libera',
  await fi.locator('text=/Só um analista libera/').isVisible())

// --- 7. Analista resolve, com justificativa obrigatória
await an.goto(B + '/alertas')
await an.waitForTimeout(900)
const cartao = an.locator('section').filter({ hasText: nomeBloqueado }).first()
await cartao.getByRole('button', { name: 'Liberar com ressalva' }).click()
await an.waitForTimeout(400)
check('liberar sem justificativa é recusado',
  await an.locator('text=/Justificativa obrigatória/').first().isVisible())
await cartao.locator('textarea').fill('Placa conferida no documento do veículo; escala estava desatualizada.')
await cartao.getByRole('button', { name: 'Liberar com ressalva' }).click()
await an.waitForTimeout(900)
check('alerta sai da fila depois de resolvido',
  (await an.locator('section').filter({ hasText: nomeBloqueado }).count()) === 0)

// --- 8. Driver avulso chega ao fiscal marcado como novo
await an.goto(B + '/escala')
await an.waitForTimeout(800)
await an.getByRole('button', { name: 'Adicionar' }).click()
await an.waitForTimeout(300)
await an.locator('input[placeholder="SPX48231"]').fill('SPX77777')
await an.locator('input[placeholder="Nome completo"]').fill('Driver Do Meio Do Turno')
await an.locator('input[placeholder="Fiat Fiorino"]').fill('Renault Kangoo')
await an.locator('input[placeholder="Branco"]').fill('Branco')
await an.locator('input[placeholder="ABC1D23"]').fill('QQQ1Q23')
await an.locator('input[placeholder="A-15"]').fill('C-04')
await an.getByRole('button', { name: 'Adicionar à escala' }).click()
await an.waitForTimeout(800)

await fi.goto(B + '/patio')
await fi.waitForTimeout(900)
const avulso = fi.locator('ul > li a').filter({ hasText: 'Driver Do Meio Do Turno' }).first()
check('driver avulso aparece na lista do fiscal', await avulso.isVisible())
check('driver avulso vem marcado como Novo', (await avulso.locator('text=Novo').count()) > 0)

// --- 9. Auditoria
await an.goto(B + '/auditoria')
await an.waitForTimeout(900)
const txt = (await an.locator('ul li').allInnerTexts()).join('\n')
for (const [rotulo, re] of [
  ['importação da planilha', /Importou escala/],
  ['conferência do fiscal', /Conferiu driver/],
  ['divergência reportada', /Reportou divergência/],
  ['liberação do bloqueio', /Liberou bloqueio/],
  ['driver adicionado', /Adicionou driver/],
  ['nome de quem conferiu', /Vinícius Lopes/],
  ['nome de quem liberou', /Marcos Vinholi/],
]) check(`auditoria registra: ${rotulo}`, new RegExp(re.source, 'i').test(txt))

// --- 10. Relatórios
await an.goto(B + '/relatorios')
await an.waitForTimeout(1000)
check('detalhamento traz 14 dias', (await an.locator('tbody tr').count()) === 14)
const [download] = await Promise.all([
  an.waitForEvent('download'),
  an.getByRole('button', { name: 'Exportar CSV' }).click(),
])
check('exporta CSV', (await download.suggestedFilename()).endsWith('.csv'),
  await download.suggestedFilename())

// --- 11. Simulador
await an.goto(B + '/painel')
await an.waitForTimeout(800)
const sim0 = num(await conferidosKpi.innerText())
await an.locator('nav button').filter({ hasText: 'Simulador' }).first().click()
await an.waitForTimeout(15000)
const sim1 = num(await conferidosKpi.innerText())
check('simulador move o painel sozinho', sim1 > sim0, `${sim0} → ${sim1} em 15s`)
await an.locator('nav button').filter({ hasText: 'Simulador' }).first().click()

// --- 12. Permissões do líder
const li = await aba('u-lider-1')
await li.goto(B + '/painel')
await li.waitForTimeout(800)
check('líder não tem acesso à Escala', (await li.locator('nav a', { hasText: 'Escala' }).count()) === 0)
await li.goto(B + '/alertas')
await li.waitForTimeout(900)
check('líder não vê botão de liberar bloqueio',
  (await li.getByRole('button', { name: 'Liberar com ressalva' }).count()) === 0)

// --- 13. Mobile
await fi.goto(B + '/patio')
await fi.waitForTimeout(700)
const larg = await fi.evaluate(() => document.documentElement.scrollWidth)
check('lista do fiscal cabe em 390px sem rolagem lateral', larg <= 390, `${larg}px`)
const alturaBotao = await (async () => {
  await fi.locator('ul > li a').first().click()
  await fi.waitForTimeout(500)
  return (await fi.getByRole('button', { name: 'Tudo certo' }).boundingBox()).height
})()
check('botão principal do fiscal tem alvo de toque grande', alturaBotao >= 44, `${Math.round(alturaBotao)}px`)

await browser.close()
console.log('\nerros de console/página:', erros.length ? erros.slice(0, 8) : 'nenhum')
console.log(falhas === 0 ? '\nTODAS AS VERIFICAÇÕES PASSARAM' : `\n${falhas} FALHA(S)`)
process.exit(falhas ? 1 : 0)
