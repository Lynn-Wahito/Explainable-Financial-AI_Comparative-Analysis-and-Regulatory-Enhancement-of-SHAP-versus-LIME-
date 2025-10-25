# backend/src/ml/schemas.py
from pydantic import BaseModel, Field

class PredictIn(BaseModel):
    # Exactly the 23 numeric features used by training
    LIMIT_BAL: float = Field(..., description="Credit limit of the individual")
    SEX: float = Field(..., description="1=male, 2=female")
    EDUCATION: float = Field(..., description="1=grad school, 2=university, 3=high school, 4=others")
    MARRIAGE: float = Field(..., description="1=married, 2=single, 3=others")
    AGE: float = Field(..., description="Age in years")

    PAY_0: float = Field(..., description="Repayment status in September (most recent)")
    PAY_2: float = Field(..., description="Repayment status in August")
    PAY_3: float = Field(..., description="Repayment status in July")
    PAY_4: float = Field(..., description="Repayment status in June")
    PAY_5: float = Field(..., description="Repayment status in May")
    PAY_6: float = Field(..., description="Repayment status in April")

    BILL_AMT1: float = Field(..., description="Bill amount in September")
    BILL_AMT2: float = Field(..., description="Bill amount in August")
    BILL_AMT3: float = Field(..., description="Bill amount in July")
    BILL_AMT4: float = Field(..., description="Bill amount in June")
    BILL_AMT5: float = Field(..., description="Bill amount in May")
    BILL_AMT6: float = Field(..., description="Bill amount in April")

    PAY_AMT1: float = Field(..., description="Amount paid in September")
    PAY_AMT2: float = Field(..., description="Amount paid in August")
    PAY_AMT3: float = Field(..., description="Amount paid in July")
    PAY_AMT4: float = Field(..., description="Amount paid in June")
    PAY_AMT5: float = Field(..., description="Amount paid in May")
    PAY_AMT6: float = Field(..., description="Amount paid in April")


class PredictOut(BaseModel):
    model: str = Field(..., description="Model class/type name")
    predicted_label: int = Field(..., description="0 = non-default, 1 = default")
    probability: float = Field(..., description="Probability of default (if available)")

    class Config:
        # Pydantic v2 compatibility (avoids warnings when used with ORM objects)
        from_attributes = True
