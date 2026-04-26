import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DeviceCondition(str, enum.Enum):
    GOOD = "GOOD"
    FAIR = "FAIR"
    POOR = "POOR"
    DAMAGED = "DAMAGED"


class DeviceStatus(str, enum.Enum):
    CHECKED_IN = "CHECKED_IN"
    CHECKED_OUT = "CHECKED_OUT"


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        UniqueConstraint(
            "serial_number", "customer_account_id", name="uq_devices_serial_number_account"
        ),
        CheckConstraint(
            "status != 'CHECKED_IN' OR location_id IS NOT NULL",
            name="ck_devices_checked_in_requires_location",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    customer_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customer_accounts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    device_model_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("device_models.id", ondelete="RESTRICT"),
        nullable=False,
    )
    serial_number: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_tag: Mapped[str | None] = mapped_column(String(255), nullable=True)
    condition: Mapped[DeviceCondition] = mapped_column(
        Enum(DeviceCondition, name="devicecondition", create_type=False),
        nullable=False,
        default=DeviceCondition.GOOD,
    )
    status: Mapped[DeviceStatus] = mapped_column(
        Enum(DeviceStatus, name="devicestatus", create_type=False),
        nullable=False,
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    checked_in_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("engineers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    checked_out_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("engineers.id", ondelete="RESTRICT"),
        nullable=True,
    )
    checked_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    checked_out_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    customer_account: Mapped["CustomerAccount"] = relationship(  # noqa: F821
        "CustomerAccount", lazy="noload"
    )
    device_model: Mapped["DeviceModel"] = relationship(  # noqa: F821
        "DeviceModel", lazy="noload"
    )
    location: Mapped["Location | None"] = relationship(  # noqa: F821
        "Location", lazy="noload"
    )
    checked_in_by: Mapped["Engineer"] = relationship(  # noqa: F821
        "Engineer", foreign_keys=[checked_in_by_id], lazy="noload"
    )
    checked_out_by: Mapped["Engineer | None"] = relationship(  # noqa: F821
        "Engineer", foreign_keys=[checked_out_by_id], lazy="noload"
    )
