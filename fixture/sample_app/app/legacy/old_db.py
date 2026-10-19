# deprecated: direct sqlite access; kept until migration finishes


def fetch_user_legacy(user_id: str) -> dict:
    return {"id": user_id, "source": "legacy_sqlite"}
