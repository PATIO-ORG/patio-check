from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


class Usuario(BaseModel):
    id: str
    nome: str
    email: str
    papel: Literal['fiscal', 'analista', 'lider']
    ativo: bool = True


class Divergencia(BaseModel):
    tipo: Literal['placa', 'veiculo', 'nome', 'id', 'ocupante']
    encontrado: str


class CheckinInput(BaseModel):
    escalaItemId: str
    fiscalId: str
    resultado: Literal['conforme', 'irregular']
    observacao: str | None = None
    divergencias: list[Divergencia] = Field(default_factory=list)


class ResolucaoInput(BaseModel):
    irregularidadeId: str
    usuarioId: str
    decisao: Literal['liberado', 'mantido_bloqueado']
    justificativa: str


class PreviaInput(BaseModel):
    csv: str


USUARIOS = [
    Usuario(id='u-fiscal-1', nome='Vinícius Lopes', email='vinicius.lopes@spx.local', papel='fiscal'),
    Usuario(id='u-analista-1', nome='Marcos Vinholi', email='marcos.vinholi@spx.local', papel='analista'),
    Usuario(id='u-lider-1', nome='Cláudia Bastos', email='claudia.bastos@spx.local', papel='lider'),
]

# Estado temporário para a primeira integração. Esta camada será substituída por
# repositórios SQLAlchemy sem mudar os endpoints públicos.
ESCALAS: dict[str, dict] = {}
ITENS: dict[str, dict] = {}
IRREGULARIDADES: dict[str, dict] = {}
AUDITORIA: list[dict] = []
EVENTOS: list[WebSocket] = []

app = FastAPI(title='Patio Check API', version='0.1.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://localhost:4173'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/')
def raiz() -> dict[str, str]:
    return {
        'servico': 'Patio Check API',
        'status': 'ok',
        'documentacao': '/docs',
        'saude': '/health',
    }


def agora() -> str:
    return datetime.now(UTC).isoformat()


def evento(acao: str, entidade: str, entidade_id: str, usuario_id: str) -> None:
    AUDITORIA.append({
        'id': f'log-{uuid4().hex[:8]}',
        'usuarioId': usuario_id,
        'acao': acao,
        'entidade': entidade,
        'entidadeId': entidade_id,
        'em': agora(),
    })


def detalhar(item: dict) -> dict:
    return {
        'item': item,
        'motorista': item['motorista'],
        'ultimoCheckin': item.get('ultimoCheckin'),
        'irregularidades': [
            irregularidade for irregularidade in IRREGULARIDADES.values()
            if irregularidade['escalaItemId'] == item['id']
        ],
    }


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.get('/usuarios', response_model=list[Usuario])
def listar_usuarios() -> list[Usuario]:
    return USUARIOS


@app.get('/escalas/{data}')
def obter_escala(data: str) -> dict | None:
    return ESCALAS.get(data)


@app.get('/escalas/{data}/itens')
def listar_itens(data: str) -> list[dict]:
    escala = ESCALAS.get(data)
    if not escala:
        return []
    return [detalhar(item) for item in ITENS.values() if item['escalaId'] == escala['id']]


@app.post('/planilhas/previa')
def previa_planilha(input: PreviaInput) -> dict:
    linhas = [linha.strip() for linha in input.csv.splitlines() if linha.strip()]
    if linhas and ('driver' in linhas[0].lower() or 'placa' in linhas[0].lower()):
        linhas = linhas[1:]

    validas = []
    invalidas = []
    for numero, texto in enumerate(linhas, start=1):
        colunas = [coluna.strip() for coluna in texto.replace(';', ',').split(',')]
        valores = (colunas + [''] * 7)[:7]
        linha = {
            'linha': numero,
            'driverId': valores[0].upper(),
            'nome': valores[1],
            'veiculoModelo': valores[2],
            'veiculoCor': valores[3],
            'placa': valores[4].upper().replace('-', ''),
            'rota': valores[5].upper(),
            'turno': valores[6].lower(),
            'erros': [],
        }
        if len(colunas) < 6:
            linha['erros'].append('Esperadas 7 colunas')
        if not linha['driverId'] or not linha['nome'] or not linha['placa']:
            linha['erros'].append('Driver, nome e placa são obrigatórios')
        (invalidas if linha['erros'] else validas).append(linha)

    return {'validas': validas, 'invalidas': invalidas}


@app.post('/planilhas/importar', status_code=204)
def importar_planilha(input: dict) -> None:
    escala = ESCALAS.setdefault(input['data'], {
        'id': f'esc-{uuid4().hex[:8]}',
        'data': input['data'],
        'criadaPor': input['usuarioId'],
        'origem': 'planilha',
        'criadaEm': agora(),
    })
    for linha in input.get('linhas', []):
        item_id = f'it-{uuid4().hex[:8]}'
        ITENS[item_id] = {
            'id': item_id,
            'escalaId': escala['id'],
            'motoristaId': linha['driverId'],
            'rota': linha['rota'],
            'turno': linha['turno'],
            'status': 'aguardando',
            'adicionadoEm': agora(),
            'adicionadoPor': input['usuarioId'],
            'avulso': False,
            'motorista': {
                'id': linha['driverId'],
                'driverId': linha['driverId'],
                'nome': linha['nome'],
                'veiculoModelo': linha['veiculoModelo'],
                'veiculoCor': linha['veiculoCor'],
                'placa': linha['placa'],
            },
        }
    evento('escala.importada', 'escala', escala['id'], input['usuarioId'])


@app.post('/escalas/itens', status_code=204)
def adicionar_item(input: dict) -> None:
    escala = ESCALAS.setdefault(input['data'], {
        'id': f"esc-{uuid4().hex[:8]}",
        'data': input['data'],
        'criadaPor': input['usuarioId'],
        'origem': 'manual',
        'criadaEm': agora(),
    })
    motorista = input['motorista']
    motorista_id = motorista.get('id', motorista.get('driverId', f"m-{uuid4().hex[:8]}"))
    item_id = f"it-{uuid4().hex[:8]}"
    ITENS[item_id] = {
        'id': item_id,
        'escalaId': escala['id'],
        'motoristaId': motorista_id,
        'rota': input['rota'].upper(),
        'turno': input['turno'],
        'status': 'aguardando',
        'adicionadoEm': agora(),
        'adicionadoPor': input['usuarioId'],
        'avulso': True,
        'motorista': {**motorista, 'id': motorista_id},
    }
    evento('escala.item_adicionado', 'escala_item', item_id, input['usuarioId'])


@app.patch('/escalas/itens/{item_id}', status_code=204)
def editar_item(item_id: str, input: dict) -> None:
    item = ITENS.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail='Item de escala não encontrado.')
    item['motorista'] = {**item['motorista'], **input.get('motorista', {})}
    if input.get('rota'):
        item['rota'] = input['rota'].upper()
    if input.get('turno'):
        item['turno'] = input['turno']
    evento('escala.item_editado', 'escala_item', item_id, input['usuarioId'])


@app.delete('/escalas/itens/{item_id}', status_code=204)
def remover_item(item_id: str, input: dict) -> None:
    if item_id not in ITENS:
        raise HTTPException(status_code=404, detail='Item de escala não encontrado.')
    del ITENS[item_id]
    evento('escala.item_removido', 'escala_item', item_id, input['usuarioId'])


@app.post('/checkins')
def registrar_checkin(input: CheckinInput) -> dict:
    item = ITENS.get(input.escalaItemId)
    if not item:
        return {'ok': False, 'erro': 'Item de escala não encontrado.'}
    if item['status'] == 'bloqueado':
        return {'ok': False, 'erro': 'Item bloqueado: só um analista pode resolver o bloqueio.'}

    item['status'] = 'liberado' if input.resultado == 'conforme' else 'bloqueado'
    item['ultimoCheckin'] = {
        'id': f'chk-{uuid4().hex[:8]}',
        'escalaItemId': item['id'],
        'fiscalId': input.fiscalId,
        'em': agora(),
        'resultado': input.resultado,
        'observacao': input.observacao,
    }
    for divergencia in input.divergencias:
        irregularidade_id = f'irr-{uuid4().hex[:8]}'
        IRREGULARIDADES[irregularidade_id] = {
            'id': irregularidade_id,
            'checkinId': item['ultimoCheckin']['id'],
            'escalaItemId': item['id'],
            'tipo': divergencia.tipo,
            'esperado': '',
            'encontrado': divergencia.encontrado,
        }
    evento('checkin.registrado', 'escala_item', item['id'], input.fiscalId)
    return {'ok': True, 'status': item['status']}


@app.post('/bloqueios/resolver')
def resolver_bloqueio(input: ResolucaoInput) -> dict:
    usuario = next((usuario for usuario in USUARIOS if usuario.id == input.usuarioId), None)
    irregularidade = IRREGULARIDADES.get(input.irregularidadeId)
    if not usuario or usuario.papel != 'analista':
        return {'ok': False, 'erro': 'Somente um analista pode resolver bloqueios.'}
    if not irregularidade:
        return {'ok': False, 'erro': 'Irregularidade não encontrada.'}
    if len(input.justificativa.strip()) < 10:
        return {'ok': False, 'erro': 'Justificativa obrigatória, com pelo menos 10 caracteres.'}

    item = ITENS[irregularidade['escalaItemId']]
    if item['status'] != 'bloqueado':
        return {'ok': False, 'erro': 'Este item não está bloqueado.'}
    item['status'] = 'liberado_com_ressalva' if input.decisao == 'liberado' else 'bloqueado'
    evento('bloqueio.liberado' if input.decisao == 'liberado' else 'bloqueio.mantido', 'irregularidade', irregularidade['id'], usuario.id)
    return {'ok': True, 'status': item['status']}


@app.get('/alertas')
def listar_alertas(data: str = Query(...)) -> list[dict]:
    escala = ESCALAS.get(data)
    if not escala:
        return []
    return [
        {
            'irregularidadeId': irregularidade['id'],
            'escalaItemId': irregularidade['escalaItemId'],
            'tipo': irregularidade['tipo'],
            'esperado': irregularidade['esperado'],
            'encontrado': irregularidade['encontrado'],
            'em': agora(),
            'fiscalNome': 'Fiscal de pátio',
            'motorista': ITENS[irregularidade['escalaItemId']]['motorista'],
            'rota': ITENS[irregularidade['escalaItemId']]['rota'],
        }
        for irregularidade in IRREGULARIDADES.values()
        if irregularidade['escalaItemId'] in [item['id'] for item in ITENS.values() if item['escalaId'] == escala['id']]
    ]


@app.get('/relatorios/resumo')
def resumo(data: str = Query(...)) -> dict:
    itens = [item for item in ITENS.values() if ESCALAS.get(data, {}).get('id') == item['escalaId']]
    conferidos = sum(item['status'] != 'aguardando' for item in itens)
    liberados = sum(item['status'] == 'liberado' for item in itens)
    return {
        'data': data,
        'escalados': len(itens),
        'conferidos': conferidos,
        'pendentes': len(itens) - conferidos,
        'bloqueados': sum(item['status'] == 'bloqueado' for item in itens),
        'liberadosComRessalva': sum(item['status'] == 'liberado_com_ressalva' for item in itens),
        'taxaConformidade': round(liberados / conferidos * 100) if conferidos else 0,
    }


@app.get('/relatorios/conformidade-hora')
def conformidade_hora(data: str = Query(...)) -> list[dict]:
    return [{'hora': f'{hora:02d}h', 'conformes': 0, 'irregulares': 0} for hora in range(5, 15)]


@app.get('/relatorios/irregularidades')
def irregularidades(data: str = Query(...)) -> list[dict]:
    return []


@app.get('/relatorios/historico')
def historico(dias: int = Query(...), ate: str = Query(...)) -> list[dict]:
    return []


@app.get('/auditoria')
def auditoria(data: str | None = None, usuarioId: str | None = None) -> list[dict]:
    return [
        {**registro, 'usuarioNome': next((u.nome for u in USUARIOS if u.id == registro['usuarioId']), 'Desconhecido')}
        for registro in AUDITORIA
        if (not data or registro['em'].startswith(data)) and (not usuarioId or registro['usuarioId'] == usuarioId)
    ]


@app.websocket('/ws/eventos')
async def eventos(websocket: WebSocket) -> None:
    await websocket.accept()
    EVENTOS.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    finally:
        EVENTOS.remove(websocket)
