import { describe, expect, it } from 'vitest'
import { SupabaseDataSource } from './SupabaseDataSource'

describe('SupabaseDataSource.previsualizarPlanilha', () => {
  const dataSource = new SupabaseDataSource(null)

  it('finds a normal semicolon CSV header after introduction rows and skips blank shifts', async () => {
    const preview = await dataSource.previsualizarPlanilha([
      'Relatório operacional;unidade;expedição',
      'Instruções antes da tabela;;;;;;',
      'driver_id;nome;veiculo;cor;placa;rota;turno',
      'SPX90001;Ana Paula Ribeiro;Fiat Fiorino;Branco;RJK4E12;A-07;manha',
      ';;;;;;;;',
    ].join('\n'))

    expect(preview.erro).toBeUndefined()
    expect(preview.validas).toHaveLength(1)
    expect(preview.invalidas).toHaveLength(0)
    expect(preview.validas[0]).toMatchObject({
      driverId: 'SPX90001',
      nome: 'Ana Paula Ribeiro',
      veiculoModelo: 'Fiat Fiorino',
      rota: 'A-07',
      turno: 'manha',
    })
  })

  it('reads the JDF printing CSV columns and infers shift from time', async () => {
    const preview = await dataSource.previsualizarPlanilha([
      'DIVISÃO DE TAREFAS,,,,,,,,',
      'HORÁRIO,LETRA,ID,DRIVER ESCALADO,TIPO,PLACA,Validação,Column 9,Column 1',
      '13:00,B-3,1324707,Ana Paula Ribeiro,MOTO,RJK4E12,,,Não chegou',
      '13:00,,,,,,,,Não chegou',
    ].join('\n'))

    expect(preview.erro).toBeUndefined()
    expect(preview.validas).toHaveLength(1)
    expect(preview.invalidas).toHaveLength(0)
    expect(preview.validas[0]).toMatchObject({
      driverId: '1324707',
      nome: 'Ana Paula Ribeiro',
      veiculoModelo: 'MOTO',
      rota: 'B-3',
      turno: 'tarde',
    })
  })
})
