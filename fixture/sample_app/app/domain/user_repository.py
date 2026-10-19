# DECISION: We chose repository interfaces so handlers never touch SQL directly.


class UserRepository:
    def get_by_id(self, user_id: str) -> dict | None:
        return {"id": user_id, "name": "demo"}
