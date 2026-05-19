import enum


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    COMPANY_ADMIN = "COMPANY_ADMIN"
    MANAGER = "MANAGER"
    AGENT = "AGENT"


class SessionType(str, enum.Enum):
    PHONE_CALL = "PHONE_CALL"
    ONLINE_MEETING = "ONLINE_MEETING"


class SessionStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class PersonaDifficulty(str, enum.Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"
    EXPERT = "EXPERT"


class Framework(str, enum.Enum):
    MEDDIC = "MEDDIC"
    MEDDICC = "MEDDICC"
    SPIN = "SPIN"
    BANT = "BANT"
    CHALLENGER = "CHALLENGER"
    SNAP = "SNAP"


class TimelineEventType(str, enum.Enum):
    ISSUE = "ISSUE"
    GOOD = "GOOD"
    WARNING = "WARNING"
    NEUTRAL = "NEUTRAL"
