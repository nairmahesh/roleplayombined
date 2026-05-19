from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FrameworkStatItem(BaseModel):
    component: str
    avgScore: Optional[float] = None
    count: int


class RecentSession(BaseModel):
    id: str
    endedAt: Optional[datetime] = None
    durationSeconds: Optional[int] = None
    framework: str
    sessionType: str
    personaName: str
    personaEmoji: str
    userFirstName: str
    userLastName: str
    totalScore: Optional[float] = None


class AgentDashboardExtra(BaseModel):
    sessionsThisWeek: int
    streak: int
    rank: Optional[int] = None


class TeamMemberSummary(BaseModel):
    id: str
    firstName: str
    lastName: str
    avatarUrl: Optional[str] = None
    sessionCount: int
    avgScore: Optional[float] = None
    sessionsThisWeek: int
    lastSessionAt: Optional[datetime] = None


class ManagerDashboardExtra(BaseModel):
    teamSize: int
    members: list[TeamMemberSummary]


class DashboardResponse(BaseModel):
    totalSessions: int
    avgScore: Optional[float] = None
    activeUsers: int
    passRate: float
    frameworkStats: list[FrameworkStatItem]
    recentSessions: list[RecentSession]
    agentExtra: Optional[AgentDashboardExtra] = None
    managerExtra: Optional[ManagerDashboardExtra] = None


class LeaderboardUser(BaseModel):
    id: str
    firstName: str
    lastName: str
    avatarUrl: Optional[str] = None


class LeaderboardEntry(BaseModel):
    rank: int
    user: LeaderboardUser
    avgScore: float
    sessionCount: int
