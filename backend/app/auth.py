import os

from fastapi import HTTPException, Request
from jose import JWTError, jwt

JWT_SECRET = os.getenv('SUPABASE_JWT_SECRET')

PUBLIC_PATHS = {'/', '/health', '/docs', '/openapi.json', '/redoc'}


def usuario_atual(request: Request) -> str:
    """Valida o JWT emitido pelo Supabase e devolve o subject (auth.users.id)."""
    if not JWT_SECRET:
        raise HTTPException(
            status_code=503,
            detail='SUPABASE_JWT_SECRET não configurado no backend.',
        )

    cabecalho = request.headers.get('Authorization', '')
    esquema, _, token = cabecalho.partition(' ')
    if esquema.lower() != 'bearer' or not token:
        raise HTTPException(status_code=401, detail='Token de acesso ausente.')

    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=['HS256'], audience='authenticated')
    except JWTError as erro:
        raise HTTPException(status_code=401, detail='Token de acesso inválido.') from erro

    subject = claims.get('sub')
    if not isinstance(subject, str):
        raise HTTPException(status_code=401, detail='Token sem identificador de usuário.')
    return subject
