from datetime import UTC, date, datetime, timedelta
import os
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from .auth import PUBLIC_PATHS, usuario_atual
from .db import cliente, dados, uma


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


app = FastAPI(title='Patio Check API', version='0.2.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:4173').split(','),
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class AutenticacaoMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if os.getenv('SUPABASE_JWT_SECRET') and request.url.path not in PUBLIC_PATHS:
            try:
                request.state.usuario_id = usuario_atual(request)
            except HTTPException as erro:
                return JSONResponse({'detail': erro.detail}, status_code=erro.status_code)
        return await call_next(request)


app.add_middleware(AutenticacaoMiddleware)


def agora() -> str:
    return datetime.now(UTC).isoformat()


def ator(request: Request, informado: str, papeis: tuple[str, ...]) -> dict:
    usuario_id = getattr(request.state, 'usuario_id', None)
    if usuario_id and usuario_id != informado:
        raise HTTPException(status_code=403, detail='O usuário informado não corresponde ao token.')
    perfil = uma(cliente().table('usuarios').select('*').eq('id', informado).eq('ativo', True).execute())
    if not perfil or perfil['papel'] not in papeis:
        raise HTTPException(status_code=403, detail='Usuário sem permissão para esta operação.')
    return perfil


def camel_usuario(row: dict) -> dict:
    return {
        'id': row['id'],
        'nome': row['nome'],
        'email': row['email'],
        'papel': row['papel'],
        'ativo': row.get('ativo', True),
    }


def camel_motorista(row: dict) -> dict:
    return {
        'id': row['id'],
        'driverId': row['driver_id'],
        'nome': row['nome'],
        'veiculoModelo': row['veiculo_modelo'],
        'veiculoCor': row['veiculo_cor'],
        'placa': row['placa'],
        **({'telefone': row['telefone']} if row.get('telefone') else {}),
    }


def camel_item(row: dict) -> dict:
    return {
        'id': row['id'],
        'escalaId': row['escala_id'],
        'motoristaId': row['motorista_id'],
        'rota': row['rota'],
        'turno': row['turno'],
        'status': row['status'],
        'adicionadoEm': row['adicionado_em'],
        'adicionadoPor': row['adicionado_por'],
        'avulso': row['avulso'],
    }


def camel_irregularidade(row: dict) -> dict:
    return {
        'id': row['id'],
        'checkinId': row['checkin_id'],
        'escalaItemId': row['escala_item_id'],
        'tipo': row['tipo'],
        'esperado': row['esperado'],
        'encontrado': row['encontrado'],
        **({'fotoUrl': row['foto_url']} if row.get('foto_url') else {}),
    }


def detalhar(row: dict) -> dict:
    db = cliente()
    item = camel_item(row)
    motorista = camel_motorista(row['motorista'])
    checkins = dados(
        db.table('checkins').select('*').eq('escala_item_id', item['id']).order('em').execute()
    )
    ultimo = checkins[-1] if checkins else None
    ultimo_checkin = None
    if ultimo:
        ultimo_checkin = {
            'id': ultimo['id'],
            'escalaItemId': ultimo['escala_item_id'],
            'fiscalId': ultimo['fiscal_id'],
            'em': ultimo['em'],
            'resultado': ultimo['resultado'],
            **({'observacao': ultimo['observacao']} if ultimo.get('observacao') else {}),
        }
    irregularidades = dados(
        db.table('irregularidades').select('*').eq('escala_item_id', item['id']).execute()
    )
    return {
        'item': item,
        'motorista': motorista,
        'ultimoCheckin': ultimo_checkin,
        'irregularidades': [camel_irregularidade(i) for i in irregularidades],
    }


@app.get('/')
def raiz() -> dict[str, str]:
    return {'servico': 'Patio Check API', 'status': 'ok', 'documentacao': '/docs', 'saude': '/health'}


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.get('/usuarios', response_model=list[Usuario])
def listar_usuarios() -> list[Usuario]:
    return [camel_usuario(u) for u in dados(cliente().table('usuarios').select('*').eq('ativo', True).execute())]


@app.get('/escalas/{data}')
def obter_escala(data: str) -> dict | None:
    escala = uma(cliente().table('escalas').select('*').eq('data', data).execute())
    if not escala:
        return None
    return {
        'id': escala['id'],
        'data': escala['data'],
        'criadaPor': escala['criada_por'],
        'origem': escala['origem'],
        'criadaEm': escala['criada_em'],
    }


@app.get('/escalas/{data}/itens')
def listar_itens(data: str) -> list[dict]:
    db = cliente()
    escala = uma(db.table('escalas').select('id').eq('data', data).execute())
    if not escala:
        return []
    itens = dados(db.table('itens_escala').select('*, motorista:motoristas(*)').eq('escala_id', escala['id']).execute())
    if not itens:
        return []
    item_ids = [item['id'] for item in itens]
    checkins = dados(
        db.table('checkins').select('*').in_('escala_item_id', item_ids).order('em').execute()
    )
    irregularidades = dados(
        db.table('irregularidades').select('*').in_('escala_item_id', item_ids).execute()
    )
    ultimo_por_item: dict[str, dict] = {}
    for checkin in checkins:
        ultimo_por_item[checkin['escala_item_id']] = checkin
    irregularidades_por_item: dict[str, list[dict]] = {}
    for irregularidade in irregularidades:
        irregularidades_por_item.setdefault(irregularidade['escala_item_id'], []).append(irregularidade)

    resposta = []
    for row in itens:
        checkin = ultimo_por_item.get(row['id'])
        ultimo = None
        if checkin:
            ultimo = {
                'id': checkin['id'],
                'escalaItemId': checkin['escala_item_id'],
                'fiscalId': checkin['fiscal_id'],
                'em': checkin['em'],
                'resultado': checkin['resultado'],
                **({'observacao': checkin['observacao']} if checkin.get('observacao') else {}),
            }
        resposta.append({
            'item': camel_item(row),
            'motorista': camel_motorista(row['motorista']),
            'ultimoCheckin': ultimo,
            'irregularidades': [
                camel_irregularidade(item)
                for item in irregularidades_por_item.get(row['id'], [])
            ],
        })
    return resposta


@app.post('/planilhas/previa')
def previa_planilha(input: PreviaInput) -> dict:
    brutas = input.csv.splitlines()
    indice_jdf = next(
        (
            indice for indice, linha in enumerate(brutas)
            if 'horário' in linha.lower() and 'driver escalado' in linha.lower()
        ),
        -1,
    )
    formato_jdf = indice_jdf >= 0
    inicio = indice_jdf + 1 if formato_jdf else 0
    cabecalho = brutas[inicio].lower() if inicio < len(brutas) else ''
    tem_cabecalho = not formato_jdf and ('driver' in cabecalho or 'placa' in cabecalho)
    linhas = [
        (numero, linha.strip())
        for numero, linha in enumerate(
            brutas[inicio + (1 if tem_cabecalho else 0):],
            start=inicio + (2 if tem_cabecalho else 1),
        )
        if linha.strip()
    ]
    validas, invalidas = [], []
    for numero, texto in linhas:
        colunas = [coluna.strip() for coluna in texto.replace(';', ',').split(',')]
        if formato_jdf:
            horario, rota, driver_id, nome, veiculo, placa = (colunas + [''] * 6)[:6]
            hora = int(horario.split(':')[0]) if ':' in horario else 0
            turno = 'manha' if 6 <= hora < 12 else 'tarde' if 12 <= hora < 18 else 'noite'
            if not driver_id and not nome and not placa:
                continue
            valores = [driver_id, nome, veiculo, '', placa, rota, turno]
        else:
            valores = (colunas + [''] * 7)[:7]
        linha = {
            'linha': numero, 'driverId': valores[0].upper(), 'nome': valores[1],
            'veiculoModelo': valores[2], 'veiculoCor': valores[3],
            'placa': valores[4].upper().replace('-', ''), 'rota': valores[5].upper(),
            'turno': valores[6].lower(), 'erros': [],
        }
        if len(colunas) < (6 if formato_jdf else 7):
            linha['erros'].append(f'Esperadas {6 if formato_jdf else 7} colunas')
        if not linha['driverId'] or not linha['nome'] or not linha['placa']:
            linha['erros'].append('Driver, nome e placa são obrigatórios')
        (invalidas if linha['erros'] else validas).append(linha)
    return {'validas': validas, 'invalidas': invalidas}


def auditar(usuario_id: str, acao: str, entidade: str, entidade_id: str, antes: object = None, depois: object = None) -> None:
    cliente().table('auditoria').insert({
        'usuario_id': usuario_id, 'acao': acao, 'entidade': entidade,
        'entidade_id': entidade_id, 'antes': antes, 'depois': depois,
    }).execute()


def escala(data: str, usuario_id: str, origem: str) -> dict:
    db = cliente()
    existente = uma(db.table('escalas').select('*').eq('data', data).execute())
    if existente:
        return existente
    return uma(db.table('escalas').insert({
        'data': data, 'criada_por': usuario_id, 'origem': origem,
    }).execute())  # type: ignore[return-value]


@app.post('/planilhas/importar', status_code=204)
def importar_planilha(request: Request, input: dict) -> None:
    ator(request, input['usuarioId'], ('analista',))
    db = cliente()
    esc = escala(input['data'], input['usuarioId'], 'planilha')
    linhas = input.get('linhas', [])
    motoristas = [{
            'driver_id': linha['driverId'], 'nome': linha['nome'],
            'veiculo_modelo': linha['veiculoModelo'], 'veiculo_cor': linha['veiculoCor'],
            'placa': linha['placa'],
        } for linha in linhas]
    if not motoristas:
        return
    db.table('motoristas').upsert(motoristas, on_conflict='driver_id').execute()
    motoristas_gravados = dados(
        db.table('motoristas')
        .select('id, driver_id')
        .in_('driver_id', [linha['driverId'] for linha in linhas])
        .execute()
    )
    por_driver = {motorista['driver_id']: motorista['id'] for motorista in motoristas_gravados}
    faltantes = [linha['driverId'] for linha in linhas if linha['driverId'] not in por_driver]
    if faltantes:
        raise HTTPException(
            status_code=502,
            detail=f'Não foi possível localizar os motoristas importados: {", ".join(faltantes[:5])}.',
        )
    itens = [{
        'escala_id': esc['id'], 'motorista_id': por_driver[linha['driverId']],
        'rota': linha['rota'], 'turno': linha['turno'],
        'adicionado_por': input['usuarioId'], 'avulso': False,
    } for linha in linhas]
    db.table('itens_escala').upsert(itens, on_conflict='escala_id,motorista_id').execute()
    auditar(input['usuarioId'], 'escala.importada', 'escala', esc['id'])


@app.post('/escalas/itens', status_code=204)
def adicionar_item(request: Request, input: dict) -> None:
    ator(request, input['usuarioId'], ('analista',))
    db = cliente()
    esc = escala(input['data'], input['usuarioId'], 'manual')
    motorista = input['motorista']
    motorista_row = uma(db.table('motoristas').upsert({
        'driver_id': motorista['driverId'], 'nome': motorista['nome'],
        'veiculo_modelo': motorista['veiculoModelo'], 'veiculo_cor': motorista['veiculoCor'],
        'placa': motorista['placa'], 'telefone': motorista.get('telefone'),
    }, on_conflict='driver_id').execute())
    item = uma(db.table('itens_escala').insert({
        'escala_id': esc['id'], 'motorista_id': motorista_row['id'], 'rota': input['rota'],
        'turno': input['turno'], 'adicionado_por': input['usuarioId'], 'avulso': True,
    }).execute())
    auditar(input['usuarioId'], 'escala.item_adicionado', 'escala_item', item['id'])


@app.patch('/escalas/itens/{item_id}', status_code=204)
def editar_item(request: Request, item_id: str, input: dict) -> None:
    ator(request, input['usuarioId'], ('analista',))
    db = cliente()
    item = uma(db.table('itens_escala').select('*, motorista:motoristas(*)').eq('id', item_id).execute())
    if not item:
        raise HTTPException(status_code=404, detail='Item de escala não encontrado.')
    motorista = input.get('motorista', {})
    if motorista:
        db.table('motoristas').update({
            'nome': motorista.get('nome', item['motorista']['nome']),
            'veiculo_modelo': motorista.get('veiculoModelo', item['motorista']['veiculo_modelo']),
            'veiculo_cor': motorista.get('veiculoCor', item['motorista']['veiculo_cor']),
            'placa': motorista.get('placa', item['motorista']['placa']),
        }).eq('id', item['motorista_id']).execute()
    updates = {key: input[key] for key in ('rota', 'turno') if input.get(key)}
    if updates:
        db.table('itens_escala').update(updates).eq('id', item_id).execute()
    auditar(input['usuarioId'], 'escala.item_editado', 'escala_item', item_id)


@app.delete('/escalas/itens/{item_id}', status_code=204)
def remover_item(request: Request, item_id: str, input: dict) -> None:
    ator(request, input['usuarioId'], ('analista',))
    if not uma(cliente().table('itens_escala').select('id').eq('id', item_id).execute()):
        raise HTTPException(status_code=404, detail='Item de escala não encontrado.')
    cliente().table('itens_escala').delete().eq('id', item_id).execute()
    auditar(input['usuarioId'], 'escala.item_removido', 'escala_item', item_id)


@app.post('/checkins')
def registrar_checkin(request: Request, input: CheckinInput) -> dict:
    ator(request, input.fiscalId, ('fiscal',))
    db = cliente()
    item = uma(db.table('itens_escala').select('*').eq('id', input.escalaItemId).execute())
    if not item:
        return {'ok': False, 'erro': 'Item de escala não encontrado.'}
    if item['status'] == 'bloqueado':
        return {'ok': False, 'erro': 'Item bloqueado: só um analista pode resolver o bloqueio.'}
    status = 'liberado' if input.resultado == 'conforme' else 'bloqueado'
    checkin = uma(db.table('checkins').insert({
        'escala_item_id': item['id'], 'fiscal_id': input.fiscalId,
        'resultado': input.resultado, 'observacao': input.observacao,
    }).execute())
    db.table('itens_escala').update({'status': status}).eq('id', item['id']).execute()
    for divergencia in input.divergencias:
        db.table('irregularidades').insert({
            'checkin_id': checkin['id'], 'escala_item_id': item['id'],
            'tipo': divergencia.tipo, 'esperado': '', 'encontrado': divergencia.encontrado,
        }).execute()
    auditar(input.fiscalId, 'checkin.registrado', 'escala_item', item['id'])
    return {'ok': True, 'status': status}


@app.post('/bloqueios/resolver')
def resolver_bloqueio(request: Request, input: ResolucaoInput) -> dict:
    ator(request, input.usuarioId, ('analista',))
    if len(input.justificativa.strip()) < 10:
        return {'ok': False, 'erro': 'Justificativa obrigatória, com pelo menos 10 caracteres.'}
    db = cliente()
    irregularidade = uma(db.table('irregularidades').select('*').eq('id', input.irregularidadeId).execute())
    if not irregularidade:
        return {'ok': False, 'erro': 'Irregularidade não encontrada.'}
    item = uma(db.table('itens_escala').select('*').eq('id', irregularidade['escala_item_id']).execute())
    if not item or item['status'] != 'bloqueado':
        return {'ok': False, 'erro': 'Este item não está bloqueado.'}
    status = 'liberado_com_ressalva' if input.decisao == 'liberado' else 'bloqueado'
    db.table('itens_escala').update({'status': status}).eq('id', item['id']).execute()
    db.table('liberacoes').insert({
        'irregularidade_id': input.irregularidadeId, 'analista_id': input.usuarioId,
        'decisao': input.decisao, 'justificativa': input.justificativa,
    }).execute()
    auditar(input.usuarioId, 'bloqueio.liberado' if input.decisao == 'liberado' else 'bloqueio.mantido', 'irregularidade', input.irregularidadeId)
    return {'ok': True, 'status': status}


def itens_da_data(data: str) -> list[dict]:
    escala_row = uma(cliente().table('escalas').select('id').eq('data', data).execute())
    if not escala_row:
        return []
    return dados(cliente().table('itens_escala').select('*').eq('escala_id', escala_row['id']).execute())


@app.get('/alertas')
def listar_alertas(data: str = Query(...)) -> list[dict]:
    db = cliente()
    itens = itens_da_data(data)
    ids = [item['id'] for item in itens]
    if not ids:
        return []
    irregularidades = dados(db.table('irregularidades').select('*').in_('escala_item_id', ids).execute())
    saida = []
    for irregularidade in irregularidades:
        item = next(item for item in itens if item['id'] == irregularidade['escala_item_id'])
        motorista = uma(db.table('motoristas').select('*').eq('id', item['motorista_id']).execute())
        checkin = uma(db.table('checkins').select('em, fiscal_id').eq('id', irregularidade['checkin_id']).execute())
        fiscal = uma(db.table('usuarios').select('nome').eq('id', checkin['fiscal_id']).execute()) if checkin else None
        saida.append({
            'irregularidadeId': irregularidade['id'], 'escalaItemId': item['id'],
            'tipo': irregularidade['tipo'], 'esperado': irregularidade['esperado'],
            'encontrado': irregularidade['encontrado'], 'em': checkin['em'] if checkin else agora(),
            'fiscalNome': fiscal['nome'] if fiscal else 'Fiscal de pátio',
            'motorista': camel_motorista(motorista), 'rota': item['rota'],
        })
    return saida


@app.get('/relatorios/resumo')
def resumo(data: str = Query(...)) -> dict:
    itens = itens_da_data(data)
    conferidos = sum(item['status'] != 'aguardando' for item in itens)
    liberados = sum(item['status'] == 'liberado' for item in itens)
    return {
        'data': data, 'escalados': len(itens), 'conferidos': conferidos,
        'pendentes': len(itens) - conferidos, 'bloqueados': sum(item['status'] == 'bloqueado' for item in itens),
        'liberadosComRessalva': sum(item['status'] == 'liberado_com_ressalva' for item in itens),
        'taxaConformidade': round(liberados / conferidos * 100) if conferidos else 0,
    }


@app.get('/relatorios/conformidade-hora')
def conformidade_hora(data: str = Query(...)) -> list[dict]:
    ids = [item['id'] for item in itens_da_data(data)]
    checkins = dados(cliente().table('checkins').select('em, resultado').in_('escala_item_id', ids).execute()) if ids else []
    pontos = {f'{hora:02d}h': {'hora': f'{hora:02d}h', 'conformes': 0, 'irregulares': 0} for hora in range(5, 15)}
    for checkin in checkins:
        hora = datetime.fromisoformat(checkin['em'].replace('Z', '+00:00')).astimezone().hour
        chave = f'{hora:02d}h'
        if chave in pontos:
            pontos[chave]['conformes' if checkin['resultado'] == 'conforme' else 'irregulares'] += 1
    return list(pontos.values())


@app.get('/relatorios/irregularidades')
def irregularidades(data: str = Query(...)) -> list[dict]:
    ids = [item['id'] for item in itens_da_data(data)]
    rows = dados(cliente().table('irregularidades').select('tipo').in_('escala_item_id', ids).execute()) if ids else []
    return [{'tipo': tipo, 'total': sum(row['tipo'] == tipo for row in rows)} for tipo in ('placa', 'veiculo', 'nome', 'id', 'ocupante') if any(row['tipo'] == tipo for row in rows)]


@app.get('/relatorios/historico')
def historico(dias: int = Query(...), ate: str = Query(...)) -> list[dict]:
    final = date.fromisoformat(ate)
    return [resumo((final - timedelta(days=offset)).isoformat()) for offset in range(dias - 1, -1, -1)]


@app.get('/auditoria')
def auditoria(data: str | None = None, usuarioId: str | None = None) -> list[dict]:
    query = cliente().table('auditoria').select('*, usuario:usuarios(nome)').order('em', desc=True)
    if data:
        query = query.gte('em', f'{data}T00:00:00Z').lt('em', f'{data}T23:59:59Z')
    if usuarioId:
        query = query.eq('usuario_id', usuarioId)
    return [{
        'id': row['id'], 'usuarioId': row['usuario_id'], 'acao': row['acao'],
        'entidade': row['entidade'], 'entidadeId': row['entidade_id'],
        'antes': row.get('antes'), 'depois': row.get('depois'), 'em': row['em'],
        'usuarioNome': (row.get('usuario') or {}).get('nome', 'Desconhecido'),
    } for row in dados(query.execute())]
