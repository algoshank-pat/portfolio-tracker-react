from fastapi import APIRouter, Request

from app.core.transactions import ValidationError
from app.schemas import ValidateRequest
from app.services import portfolio as svc

router = APIRouter(prefix="/api")


@router.post("/transactions/validate")
def validate(body: ValidateRequest, request: Request) -> dict:
    settings = request.app.state.settings
    if body.csv is not None and body.rows is not None:
        raise ValidationError(['Send either "csv" or "rows", not both.'])
    if body.csv is not None:
        tx = svc.validate_csv(body.csv, settings)
    elif body.rows is not None:
        tx = svc.validate_rows(body.rows, settings)
    else:
        raise ValidationError(['Send "csv" (CSV text) or "rows" (a list of transactions).'])
    rows = svc.to_json_rows(tx)
    return {"transactions": rows, "count": len(rows)}
