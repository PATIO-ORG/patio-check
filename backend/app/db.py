import os
from functools import lru_cache

from fastapi import HTTPException
from supabase import Client, create_client


@lru_cache
def cliente() -> Client:
    url = os.getenv('SUPABASE_URL')
    chave = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not chave:
        raise HTTPException(
            status_code=503,
            detail='SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configurados.',
        )
    return create_client(url, chave)


def dados(resposta: object) -> list[dict]:
    return list(getattr(resposta, 'data', None) or [])


def uma(resposta: object) -> dict | None:
    linhas = dados(resposta)
    return linhas[0] if linhas else None
