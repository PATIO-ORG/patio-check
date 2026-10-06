import { useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SessaoProvider } from '../../auth/sessao'
import { DataProvider, HOJE, useData, useLiveData } from '../../data/provider'
import type { ItemDetalhado } from '../../domain/types'
import { ReportarDivergencia } from './ReportarDivergencia'

let alvo: ItemDetalhado

function Destino() {
  const { dados } = useLiveData((ds) => ds.listarItens(HOJE))
  const status = dados?.find((d) => d.item.id === alvo.item.id)?.item.status
  return <p>Lista do dia, status: {status}</p>
}

function Sonda({ aoLer }: { aoLer: (itens: ItemDetalhado[]) => void }) {
  const ds = useData()
  useEffect(() => {
    void ds.listarItens(HOJE).then(aoLer)
  }, [ds, aoLer])
  return null
}

function abrir() {
  return render(
    <SessaoProvider>
      <DataProvider>
        <MemoryRouter initialEntries={[`/patio/${alvo.item.id}/divergencia`]}>
          <Routes>
            <Route path="/patio/:itemId/divergencia" element={<ReportarDivergencia />} />
            <Route path="/patio" element={<Destino />} />
          </Routes>
        </MemoryRouter>
      </DataProvider>
    </SessaoProvider>,
  )
}

const botaoEnviar = () => screen.getByRole('button', { name: 'Reportar e bloquear' })
const campoPlaca = () => screen.getByLabelText('Placa que está no veículo')

// O DataProvider usa o mock em memória do módulo: o último teste muda o estado
// dele, então os de leitura vêm antes.
describe('Reportar divergência', () => {
  beforeAll(async () => {
    sessionStorage.setItem('patio-check:usuario', 'u-fiscal-1')
    let itens: ItemDetalhado[] = []
    render(
      <DataProvider>
        <Sonda aoLer={(l) => (itens = l)} />
      </DataProvider>,
    )
    await waitFor(() => expect(itens.length).toBeGreaterThan(0))
    const candidato = itens.find(
      (d) => d.item.status === 'aguardando' && d.irregularidades.length === 0,
    )
    if (!candidato) throw new Error('Seed sem driver aguardando para o teste')
    alvo = candidato
  })

  beforeEach(() => {
    sessionStorage.setItem('patio-check:usuario', 'u-fiscal-1')
  })

  it('mantém o botão desabilitado enquanto nenhuma divergência é apontada', async () => {
    abrir()
    await screen.findByText('O que está diferente?')
    expect(botaoEnviar()).toBeDisabled()
  })

  it('mostra a comparação e habilita o botão quando a placa é diferente', async () => {
    const usuario = userEvent.setup()
    abrir()
    await screen.findByText('O que está diferente?')

    const placa = alvo.motorista.placa
    const trocada = placa.slice(0, -1) + (placa.endsWith('9') ? '8' : '9')
    await usuario.type(campoPlaca(), trocada)

    expect(screen.getByText('No pátio')).toBeInTheDocument()
    expect(screen.queryByText('Esta placa bate com a escala.')).not.toBeInTheDocument()
    expect(botaoEnviar()).toBeEnabled()
  })

  it('avisa que a placa bate com a escala quando é igual', async () => {
    const usuario = userEvent.setup()
    abrir()
    await screen.findByText('O que está diferente?')

    await usuario.type(campoPlaca(), alvo.motorista.placa)

    expect(screen.getByText('Esta placa bate com a escala.')).toBeInTheDocument()
    expect(screen.queryByText('No pátio')).not.toBeInTheDocument()
    expect(botaoEnviar()).toBeDisabled()
  })

  it('deixa o driver bloqueado ao enviar', async () => {
    const usuario = userEvent.setup()
    abrir()
    await screen.findByText('O que está diferente?')

    const placa = alvo.motorista.placa
    const trocada = placa.slice(0, -1) + (placa.endsWith('9') ? '8' : '9')
    await usuario.type(campoPlaca(), trocada)
    await usuario.click(botaoEnviar())

    expect(await screen.findByText('Lista do dia, status: bloqueado')).toBeInTheDocument()
  })
})
