"""
Billing API endpoints.
Handles subscription plan information, usage stats, and prepares
integration points for Razorpay / Stripe checkout sessions.

NOTE: The actual payment gateway integration (Razorpay/Stripe) requires
API keys configured in .env.  Currently provides plan management,
usage tracking, and mock checkout session creation.
"""

import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from ..models import User, Subscription, Organization
from .deps import get_db, get_current_user

router = APIRouter()


# ---------------------------------------------------------------------------
# Plan Definitions
# ---------------------------------------------------------------------------

PLANS = {
    "free": {
        "name": "Free",
        "price": 0,
        "max_chatbots": 2,
        "max_documents": 5,
        "max_queries_per_month": 500,
        "features": [
            "2 AI Chatbots",
            "5 Knowledge Documents",
            "500 Queries/month",
            "Community Support",
        ]
    },
    "starter": {
        "name": "Starter",
        "price": 4999,  # INR ₹4,999 / month  or  $49 USD
        "max_chatbots": 5,
        "max_documents": 25,
        "max_queries_per_month": 5000,
        "features": [
            "5 AI Chatbots",
            "25 Knowledge Documents",
            "5,000 Queries/month",
            "Email Support",
            "Basic Analytics",
        ]
    },
    "growth": {
        "name": "Growth",
        "price": 19999,  # INR ₹19,999 / month  or  $199 USD
        "max_chatbots": 25,
        "max_documents": 100,
        "max_queries_per_month": 50000,
        "features": [
            "25 AI Chatbots",
            "100 Knowledge Documents",
            "50,000 Queries/month",
            "Priority Support",
            "Advanced Analytics",
            "WhatsApp Integration",
            "Custom Branding",
        ]
    },
    "enterprise": {
        "name": "Enterprise",
        "price": 49999,  # INR ₹49,999 / month  or  $499 USD
        "max_chatbots": 999,
        "max_documents": 999,
        "max_queries_per_month": 999999,
        "features": [
            "Unlimited Chatbots",
            "Unlimited Documents",
            "Unlimited Queries",
            "Dedicated Account Manager",
            "SSO Integration",
            "Voice AI Pipeline",
            "Custom SLA",
        ]
    }
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PlanInfo(BaseModel):
    plan_id: str
    name: str
    price: int
    max_chatbots: int
    max_documents: int
    max_queries_per_month: int
    features: list[str]


class SubscriptionResponse(BaseModel):
    plan: str
    plan_name: str
    status: str
    queries_used: int
    max_queries_per_month: int
    max_chatbots: int
    max_documents: int
    current_period_end: Optional[str] = None


class UpgradePlanRequest(BaseModel):
    plan_id: str


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str
    message: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/plans", response_model=list[PlanInfo])
def get_plans():
    """Return all available subscription plans."""
    return [
        PlanInfo(plan_id=pid, **plan_data)
        for pid, plan_data in PLANS.items()
    ]


@router.get("/current", response_model=SubscriptionResponse)
def get_current_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return the current user's organization subscription details."""
    sub = db.query(Subscription).filter(
        Subscription.organization_id == user.organization_id
    ).first()

    if not sub:
        raise HTTPException(status_code=404, detail="No subscription found.")

    plan_data = PLANS.get(sub.plan, PLANS["free"])

    return SubscriptionResponse(
        plan=sub.plan,
        plan_name=plan_data["name"],
        status=sub.status,
        queries_used=sub.queries_used,
        max_queries_per_month=sub.max_queries_per_month,
        max_chatbots=sub.max_chatbots,
        max_documents=sub.max_documents,
        current_period_end=sub.current_period_end.isoformat() if sub.current_period_end else None,
    )


@router.post("/upgrade", response_model=CheckoutResponse)
def create_checkout_session(
    body: UpgradePlanRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a checkout session for plan upgrade.
    
    In production, this would:
    1. Create a Razorpay/Stripe checkout session
    2. Return the checkout URL for the frontend to redirect to
    3. The webhook endpoint would handle post-payment subscription activation
    
    For now, it directly upgrades the plan (simulating successful payment).
    """
    if body.plan_id not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan ID.")

    if body.plan_id == "free":
        raise HTTPException(status_code=400, detail="Cannot checkout for free plan. Use /downgrade instead.")

    sub = db.query(Subscription).filter(
        Subscription.organization_id == user.organization_id
    ).first()

    if not sub:
        raise HTTPException(status_code=404, detail="No subscription found.")

    plan_data = PLANS[body.plan_id]

    # -----------------------------------------------------------------------
    # TODO: Replace this block with actual Razorpay/Stripe integration:
    #
    # For RAZORPAY:
    #   import razorpay
    #   client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    #   order = client.order.create({
    #       "amount": plan_data["price"] * 100,  # paise
    #       "currency": "INR",
    #       "receipt": f"sub_{sub.id}",
    #   })
    #   return CheckoutResponse(
    #       checkout_url=f"https://checkout.razorpay.com/v1/checkout.js?order_id={order['id']}",
    #       session_id=order["id"],
    #       message="Redirect user to Razorpay checkout"
    #   )
    #
    # For STRIPE:
    #   import stripe
    #   stripe.api_key = STRIPE_SECRET_KEY
    #   session = stripe.checkout.Session.create(
    #       payment_method_types=["card"],
    #       line_items=[{...}],
    #       mode="subscription",
    #       success_url="https://yourapp.com/billing?success=true",
    #       cancel_url="https://yourapp.com/billing?cancelled=true",
    #   )
    #   return CheckoutResponse(
    #       checkout_url=session.url,
    #       session_id=session.id,
    #       message="Redirect user to Stripe checkout"
    #   )
    # -----------------------------------------------------------------------

    # Direct upgrade (mock payment success for development)
    sub.plan = body.plan_id
    sub.status = "active"
    sub.max_chatbots = plan_data["max_chatbots"]
    sub.max_documents = plan_data["max_documents"]
    sub.max_queries_per_month = plan_data["max_queries_per_month"]
    sub.queries_used = 0
    db.commit()

    return CheckoutResponse(
        checkout_url="",
        session_id=f"mock_session_{sub.id}",
        message=f"Plan upgraded to {plan_data['name']} successfully! (Development mode — no payment processed)"
    )


@router.post("/downgrade")
def downgrade_to_free(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Downgrade the organization to the free plan."""
    sub = db.query(Subscription).filter(
        Subscription.organization_id == user.organization_id
    ).first()

    if not sub:
        raise HTTPException(status_code=404, detail="No subscription found.")

    free_plan = PLANS["free"]
    sub.plan = "free"
    sub.status = "active"
    sub.max_chatbots = free_plan["max_chatbots"]
    sub.max_documents = free_plan["max_documents"]
    sub.max_queries_per_month = free_plan["max_queries_per_month"]
    sub.queries_used = 0
    sub.gateway_subscription_id = None
    db.commit()

    return {"message": "Downgraded to Free plan."}


@router.get("/usage")
def get_usage(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return usage statistics for the current organization."""
    from ..models import Chatbot, Document

    sub = db.query(Subscription).filter(
        Subscription.organization_id == user.organization_id
    ).first()

    chatbot_count = db.query(Chatbot).filter(
        Chatbot.organization_id == user.organization_id
    ).count()

    document_count = db.query(Document).filter(
        Document.organization_id == user.organization_id
    ).count()

    org = db.query(Organization).filter(
        Organization.id == user.organization_id
    ).first()

    return {
        "organization_name": org.name if org else "Unknown",
        "plan": sub.plan if sub else "free",
        "chatbots": {"used": chatbot_count, "max": sub.max_chatbots if sub else 2},
        "documents": {"used": document_count, "max": sub.max_documents if sub else 5},
        "queries": {"used": sub.queries_used if sub else 0, "max": sub.max_queries_per_month if sub else 500},
    }
