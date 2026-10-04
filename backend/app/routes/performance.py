from fastapi import APIRouter, Request

from app.schemas import TransactionsRequest
from app.services import portfolio as svc

router = APIRouter(prefix="/api")


@router.post("/performance")
def performance(body: TransactionsRequest, request: Request) -> dict:
    tx = svc.validate_rows(body.transactions, request.app.state.settings)
    return svc.performance(tx, request.app.state.prices)
