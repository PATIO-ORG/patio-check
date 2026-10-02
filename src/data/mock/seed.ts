import type {
  AuditLog,
  Checkin,
  Escala,
  EscalaItem,
  Irregularidade,
  Liberacao,
  Motorista,
  TipoIrregularidade,
  Turno,
  Usuario,
} from '../../domain/types'

export interface EstadoMock {
  usuarios: Usuario[]
  motoristas: Motorista[]
  escalas: Escala[]
  itens: EscalaItem[]
  checkins: Checkin[]
  irregularidades: Irregularidade[]
  liberacoes: Liberacao[]
  auditoria: AuditLog[]
}

/** PRNG determinístico: o seed é sempre o mesmo entre recargas e entre devs. */
function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260919)
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]
const int = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1))

const NOMES = [
  'Adriano Ferreira Lima', 'Aline Souza Prado', 'Anderson Dias Rocha',
  'Bruna Carvalho Nunes', 'Carlos Eduardo Tavares', 'Cleber Antunes Melo',
  'Daniela Ribeiro Sales', 'Diego Moreira Fontes', 'Edson Batista Correia',
  'Elaine Cristina Borges', 'Fábio Henrique Amaral', 'Fernanda Lopes Vieira',
  'Gabriel Santos Peixoto', 'Geovana Martins Duarte', 'Gilberto Araújo Pinto',
  'Helena Barros Siqueira', 'Igor Nascimento Freitas', 'Jaqueline Moura Reis',
  'João Vitor Cardoso', 'Josué Ramos Bezerra', 'Kelly Andrade Pacheco',
  'Leandro Pires Machado', 'Luana Teixeira Gomes', 'Marcelo Aguiar Brandão',
  'Mariana Figueiredo Sá', 'Matheus Oliveira Campos', 'Nathalia Rezende Cruz',
  'Otávio Mendes Guerra', 'Patrícia Coelho Farias', 'Paulo Sérgio Quirino',
  'Rafael Monteiro Assis', 'Renata Xavier Bittencourt', 'Ricardo Albuquerque Rios',
  'Roberta Cunha Valadares', 'Rodrigo Estevão Paiva', 'Sabrina Leal Mesquita',
  'Thiago Braga Fonseca', 'Vanessa Antunes Maciel', 'Wesley Domingues Lara',
  'Yasmin Castro Bandeira', 'Alexandre Novaes Brito', 'Camila Pontes Freire',
]

const VEICULOS = [
  'Fiat Fiorino', 'Fiat Strada', 'VW Saveiro', 'Renault Kangoo',
  'Peugeot Partner', 'Hyundai HR', 'Kia Bongo', 'Iveco Daily',
  'Renault Master', 'Mercedes Sprinter', 'Chevrolet Montana', 'Fiat Doblò',
  'Citroën Berlingo', 'Fiat Ducato',
]

const CORES = ['Branco', 'Prata', 'Cinza', 'Preto', 'Vermelho', 'Azul']
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const TURNOS: Turno[] = ['manha', 'tarde', 'noite']

/** Placa no padrão Mercosul: LLLNLNN. */
function placaMercosul(): string {
  const l = () => LETRAS[int(0, 25)]
  const n = () => String(int(0, 9))
  return `${l()}${l()}${l()}${n()}${l()}${n()}${n()}`
}

export function isoDia(offsetDias = 0, base = new Date()): string {
  const d = new Date(base)
  d.setDate(d.getDate() - offsetDias)
  return d.toISOString().slice(0, 10)
}

function horarioDoDia(dia: string, hora: number, minuto: number): string {
  return new Date(`${dia}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00`).toISOString()
}

export const USUARIOS: Usuario[] = [
  { id: 'u-fiscal-1', nome: 'Vinícius Lopes', email: 'vinicius.lopes@spx.local', papel: 'fiscal', ativo: true },
  { id: 'u-fiscal-2', nome: 'Juliana Prado', email: 'juliana.prado@spx.local', papel: 'fiscal', ativo: true },
  { id: 'u-analista-1', nome: 'Marcos Vinholi', email: 'marcos.vinholi@spx.local', papel: 'analista', ativo: true },
  { id: 'u-analista-2', nome: 'Tatiane Serra', email: 'tatiane.serra@spx.local', papel: 'analista', ativo: true },
  { id: 'u-lider-1', nome: 'Cláudia Bastos', email: 'claudia.bastos@spx.local', papel: 'lider', ativo: true },
]

const FISCAIS = USUARIOS.filter((u) => u.papel === 'fiscal')
const ANALISTAS = USUARIOS.filter((u) => u.papel === 'analista')

/** O histórico fictício só gera divergências apontadas à mão; "horário" é automático. */
type TipoManual = Exclude<TipoIrregularidade, 'horario'>

const TIPOS: TipoManual[] = ['placa', 'veiculo', 'nome', 'id', 'ocupante']
/** Placa é de longe o caso mais comum no pátio — o peso reflete isso. */
const TIPOS_PONDERADOS: TipoManual[] = [
  'placa', 'placa', 'placa', 'placa', 'placa', 'placa',
  'veiculo', 'veiculo', 'veiculo',
  'nome', 'id', 'ocupante',
]

function adulterar(tipo: TipoManual, m: Motorista): { esperado: string; encontrado: string } {
  switch (tipo) {
    case 'placa': {
      const alt = m.placa.slice(0, 4) + LETRAS[int(0, 25)] + m.placa.slice(5)
      return { esperado: m.placa, encontrado: alt }
    }
    case 'veiculo': {
      let outro = pick(VEICULOS)
      if (outro === m.veiculoModelo) outro = VEICULOS[0]
      return { esperado: `${m.veiculoModelo} ${m.veiculoCor}`, encontrado: `${outro} ${pick(CORES)}` }
    }
    case 'nome':
      return { esperado: m.nome, encontrado: pick(NOMES) }
    case 'id':
      return { esperado: m.driverId, encontrado: `SPX${int(10000, 99999)}` }
    case 'ocupante':
      return { esperado: 'Somente o driver', encontrado: `Driver + ${int(1, 2)} acompanhante(s) não cadastrado(s)` }
  }
}

let contador = 0
const id = (prefixo: string) => `${prefixo}-${(++contador).toString(36)}`

export function criarEstadoInicial(): EstadoMock {
  contador = 0

  const motoristas: Motorista[] = NOMES.map((nome, i) => ({
    id: `m-${i + 1}`,
    driverId: `SPX${String(48210 + i * 7).padStart(5, '0')}`,
    nome,
    veiculoModelo: pick(VEICULOS),
    veiculoCor: pick(CORES),
    placa: placaMercosul(),
    telefone: `(11) 9${int(4000, 9999)}-${int(1000, 9999)}`,
  }))

  const escalas: Escala[] = []
  const itens: EscalaItem[] = []
  const checkins: Checkin[] = []
  const irregularidades: Irregularidade[] = []
  const liberacoes: Liberacao[] = []
  const auditoria: AuditLog[] = []

  const rota = () => `${pick(['A', 'B', 'C', 'D'])}-${String(int(1, 20)).padStart(2, '0')}`

  // 14 dias fechados + o dia de hoje em andamento.
  for (let offset = 14; offset >= 0; offset--) {
    const dia = isoDia(offset)
    const hoje = offset === 0
    const analista = ANALISTAS[offset % ANALISTAS.length]
    const escalaId = id('esc')

    escalas.push({
      id: escalaId,
      data: dia,
      criadaPor: analista.id,
      origem: 'planilha',
      criadaEm: horarioDoDia(dia, 5, 40),
    })
    auditoria.push({
      id: id('log'),
      usuarioId: analista.id,
      acao: 'escala.importada',
      entidade: 'escala',
      entidadeId: escalaId,
      depois: { data: dia },
      em: horarioDoDia(dia, 5, 40),
    })

    const quantos = int(30, 40)
    const escolhidos = [...motoristas].sort(() => rand() - 0.5).slice(0, quantos)

    escolhidos.forEach((m, i) => {
      const itemId = id('it')
      // No dia de hoje, parte da escala ainda não foi conferida.
      const conferido = hoje ? i < Math.floor(quantos * 0.6) : true
      const irregular = rand() < (hoje ? 0.15 : 0.09)
      // Onda de chegada do pátio: concentrada no início da manhã e afinando ao
      // longo do dia, não distribuída por igual.
      const horaCheckin = 5 + Math.floor(10 * Math.pow(i / quantos, 1.8)) + int(0, 1)
      const em = horarioDoDia(dia, Math.min(horaCheckin, 14), int(0, 59))
      const fiscal = FISCAIS[i % FISCAIS.length]

      itens.push({
        id: itemId,
        escalaId,
        motoristaId: m.id,
        rota: rota(),
        turno: TURNOS[i % 3],
        status: 'aguardando',
        adicionadoEm: horarioDoDia(dia, 5, 40),
        adicionadoPor: analista.id,
        avulso: false,
      })
      const item = itens[itens.length - 1]

      if (!conferido) return

      const checkinId = id('chk')
      checkins.push({
        id: checkinId,
        escalaItemId: itemId,
        fiscalId: fiscal.id,
        em,
        resultado: irregular ? 'irregular' : 'conforme',
      })
      auditoria.push({
        id: id('log'),
        usuarioId: fiscal.id,
        acao: 'checkin.registrado',
        entidade: 'escala_item',
        entidadeId: itemId,
        depois: { resultado: irregular ? 'irregular' : 'conforme' },
        em,
      })

      if (!irregular) {
        item.status = 'liberado'
        return
      }

      const tipo = pick(TIPOS_PONDERADOS)
      const { esperado, encontrado } = adulterar(tipo, m)
      const irregId = id('irr')
      irregularidades.push({
        id: irregId,
        checkinId,
        escalaItemId: itemId,
        tipo,
        esperado,
        encontrado,
      })
      auditoria.push({
        id: id('log'),
        usuarioId: fiscal.id,
        acao: 'irregularidade.reportada',
        entidade: 'irregularidade',
        entidadeId: irregId,
        depois: { tipo, esperado, encontrado },
        em,
      })
      item.status = 'bloqueado'

      // Dias passados já foram resolvidos; hoje alguns seguem na fila do analista.
      const resolver = hoje ? rand() < 0.3 : true
      if (!resolver) return

      const decisao = rand() < 0.55 ? 'liberado' : 'mantido_bloqueado'
      const resolvedor = ANALISTAS[i % ANALISTAS.length]
      const emResolucao = new Date(new Date(em).getTime() + int(4, 40) * 60000).toISOString()
      liberacoes.push({
        id: id('lib'),
        irregularidadeId: irregId,
        analistaId: resolvedor.id,
        em: emResolucao,
        decisao,
        justificativa:
          decisao === 'liberado'
            ? 'Divergência conferida com o documento do veículo; cadastro estava desatualizado na escala.'
            : 'Divergência confirmada em campo. Driver não autorizado a carregar; acionada a liderança.',
      })
      auditoria.push({
        id: id('log'),
        usuarioId: resolvedor.id,
        acao: decisao === 'liberado' ? 'bloqueio.liberado' : 'bloqueio.mantido',
        entidade: 'irregularidade',
        entidadeId: irregId,
        antes: { status: 'bloqueado' },
        depois: { status: decisao === 'liberado' ? 'liberado_com_ressalva' : 'bloqueado' },
        em: emResolucao,
      })
      item.status = decisao === 'liberado' ? 'liberado_com_ressalva' : 'bloqueado'
    })
  }

  return { usuarios: USUARIOS, motoristas, escalas, itens, checkins, irregularidades, liberacoes, auditoria }
}

export { TIPOS as TIPOS_IRREGULARIDADE, VEICULOS, CORES }
