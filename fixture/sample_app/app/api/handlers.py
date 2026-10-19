# ARCHITECTURE: Handlers orchestrate only — no persistence logic here.

from app.domain.user_repository import UserRepository

# Drift: someone re-used legacy shortcut instead of the repository.
from app.legacy.old_db import fetch_user_legacy


def get_user(user_id: str) -> dict:
    # tradeoff: quick fix for one endpoint; should use UserRepository instead
    if user_id.startswith("legacy-"):
        return fetch_user_legacy(user_id)
    return UserRepository().get_by_id(user_id) or {}
