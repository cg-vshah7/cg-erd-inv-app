import enum
import uuid

from sqlalchemy import Boolean, CheckConstraint, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LocationLevel(str, enum.Enum):
    SITE = "SITE"
    BUILDING = "BUILDING"
    FLOOR = "FLOOR"
    ROOM = "ROOM"


class Location(Base):
    __tablename__ = "locations"
    __table_args__ = (
        UniqueConstraint("name", "parent_id", "customer_account_id", name="uq_location_name_parent_account"),
        CheckConstraint(
            "(level != 'SITE') OR (parent_id IS NULL)",
            name="ck_site_has_no_parent",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    level: Mapped[LocationLevel] = mapped_column(
        Enum(LocationLevel, name="locationlevel"), nullable=False
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id", ondelete="RESTRICT"), nullable=True
    )
    customer_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customer_accounts.id", ondelete="CASCADE"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    parent: Mapped["Location | None"] = relationship(
        "Location", remote_side="Location.id", back_populates="children", lazy="noload"
    )
    children: Mapped[list["Location"]] = relationship(
        "Location", back_populates="parent", lazy="noload"
    )
    customer_account: Mapped["CustomerAccount"] = relationship(  # noqa: F821
        "CustomerAccount", lazy="noload"
    )
