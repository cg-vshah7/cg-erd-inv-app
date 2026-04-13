import uuid

from sqlalchemy import Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class EngineerAccountMapping(Base):
    __tablename__ = "engineer_account_mappings"

    __table_args__ = (
        UniqueConstraint("engineer_id", "customer_account_id", name="uq_eam_engineer_account"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    engineer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("engineers.id", ondelete="CASCADE"),
        nullable=False,
    )
    customer_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customer_accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    can_manage_models: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    can_checkin_out: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    can_view_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    engineer: Mapped["Engineer"] = relationship(  # noqa: F821
        "Engineer", back_populates="account_mappings", lazy="noload"
    )
    customer_account: Mapped["CustomerAccount"] = relationship(  # noqa: F821
        "CustomerAccount", back_populates="engineer_mappings", lazy="noload"
    )
