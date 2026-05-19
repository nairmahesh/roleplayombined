import asyncio
import json
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Query
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.deps import DB, CurrentUser
from app.models.session import Session, FrameworkScore
from app.models.user import User
from app.models.enums import UserRole, SessionStatus
from app.schemas.analytics import (
    DashboardResponse,
    FrameworkStatItem,
    RecentSession,
    AgentDashboardExtra,
    TeamMemberSummary,
    ManagerDashboardExtra,
    LeaderboardEntry,
    LeaderboardUser,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _persona_display(s: Session) -> tuple[str, str]:
    """Return (displayName, displayEmoji) from persona or scenarioContext."""
    if s.persona:
        return s.persona.name, s.persona.emoji
    if s.scenarioContext:
        try:
            sc = json.loads(s.scenarioContext)
            return sc.get("displayName", "Custom Scenario"), sc.get("displayEmoji", "🎯")
        except Exception:
            pass
    return "Custom Scenario", "🎯"


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(current_user: CurrentUser, db: DB):
    role = current_user.role
    base_filter = [Session.companyId == current_user.companyId]
    if role == UserRole.AGENT:
        base_filter.append(Session.userId == current_user.id)

    session_subq = select(Session.id).where(*base_filter).scalar_subquery()

    agg_q = db.execute(
        select(
            func.count(Session.id).label("total"),
            func.avg(Session.totalScore).label("avg_score"),
        ).where(*base_filter)
    )
    active_q = db.execute(
        select(func.count(User.id)).where(
            User.companyId == current_user.companyId,
            User.isActive == True,
        )
    )
    pass_q = db.execute(
        select(func.count(Session.id)).where(*base_filter, Session.totalScore >= 70)
    )
    fw_q = db.execute(
        select(
            FrameworkScore.component,
            func.avg(FrameworkScore.score).label("avg_score"),
            func.count(FrameworkScore.id).label("count"),
        )
        .where(FrameworkScore.sessionId.in_(session_subq))
        .group_by(FrameworkScore.component)
        .order_by(func.avg(FrameworkScore.score).desc())
    )
    recent_q = db.execute(
        select(Session)
        .options(selectinload(Session.user), selectinload(Session.persona))
        .where(*base_filter, Session.status == SessionStatus.COMPLETED)
        .order_by(Session.endedAt.desc())
        .limit(6)
    )

    agg_result, active_result, pass_result, fw_result, recent_result = await asyncio.gather(
        agg_q, active_q, pass_q, fw_q, recent_q
    )

    agg = agg_result.one()
    total_sessions = agg.total or 0
    avg_score = float(agg.avg_score) if agg.avg_score else None
    active_users = active_result.scalar_one() or 0
    passing = pass_result.scalar_one() or 0
    pass_rate = round((passing / total_sessions * 100), 1) if total_sessions else 0.0

    framework_stats = [
        FrameworkStatItem(
            component=row.component,
            avgScore=float(row.avg_score) if row.avg_score else None,
            count=row.count,
        )
        for row in fw_result
    ]

    recent_sessions = [
        RecentSession(
            id=s.id,
            endedAt=s.endedAt,
            durationSeconds=s.durationSeconds,
            framework=s.framework.value,
            sessionType=s.type.value,
            personaName=_persona_display(s)[0],
            personaEmoji=_persona_display(s)[1],
            userFirstName=s.user.firstName,
            userLastName=s.user.lastName,
            totalScore=s.totalScore,
        )
        for s in recent_result.scalars().all()
        if s.user
    ]

    # ── Agent extra ───────────────────────────────────────────────────────────
    agent_extra = None
    if role == UserRole.AGENT:
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)

        week_q = db.execute(
            select(func.count(Session.id)).where(
                Session.userId == current_user.id,
                Session.createdAt >= week_ago,
                Session.status == SessionStatus.COMPLETED,
            )
        )
        streak_q = db.execute(
            select(Session.totalScore)
            .where(
                Session.userId == current_user.id,
                Session.status == SessionStatus.COMPLETED,
                Session.totalScore.isnot(None),
            )
            .order_by(Session.endedAt.desc())
            .limit(20)
        )
        rank_q = db.execute(
            select(Session.userId, func.avg(Session.totalScore).label("avg"))
            .where(
                Session.companyId == current_user.companyId,
                Session.status == SessionStatus.COMPLETED,
                Session.totalScore.isnot(None),
            )
            .group_by(Session.userId)
            .order_by(func.avg(Session.totalScore).desc())
        )

        w_r, s_r, r_r = await asyncio.gather(week_q, streak_q, rank_q)

        sessions_this_week = w_r.scalar_one() or 0

        scores = list(s_r.scalars().all())
        streak = 0
        for score in scores:
            if score >= 70:
                streak += 1
            else:
                break

        rank = None
        for i, row in enumerate(r_r.all(), 1):
            if row.userId == current_user.id:
                rank = i
                break

        agent_extra = AgentDashboardExtra(
            sessionsThisWeek=sessions_this_week,
            streak=streak,
            rank=rank,
        )

    # ── Manager / admin extra ─────────────────────────────────────────────────
    manager_extra = None
    if role in {UserRole.MANAGER, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN}:
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)

        if role == UserRole.MANAGER:
            members_cond = (User.managerId == current_user.id, User.isActive == True)
        else:
            members_cond = (
                User.companyId == current_user.companyId,
                User.isActive == True,
                User.id != current_user.id,
            )

        members_q = db.execute(select(User).where(*members_cond).limit(50))
        stats_q = db.execute(
            select(
                Session.userId,
                func.count(Session.id).label("total"),
                func.avg(Session.totalScore).label("avg"),
                func.max(Session.endedAt).label("last_at"),
            )
            .where(Session.companyId == current_user.companyId, Session.status == SessionStatus.COMPLETED)
            .group_by(Session.userId)
        )
        week_q = db.execute(
            select(Session.userId, func.count(Session.id).label("cnt"))
            .where(
                Session.companyId == current_user.companyId,
                Session.status == SessionStatus.COMPLETED,
                Session.createdAt >= week_ago,
            )
            .group_by(Session.userId)
        )

        mem_r, stat_r, wk_r = await asyncio.gather(members_q, stats_q, week_q)
        stats_map = {row.userId: row for row in stat_r.all()}
        week_map = {row.userId: row.cnt for row in wk_r.all()}

        summaries: list[TeamMemberSummary] = []
        for m in mem_r.scalars().all():
            st = stats_map.get(m.id)
            summaries.append(TeamMemberSummary(
                id=m.id,
                firstName=m.firstName,
                lastName=m.lastName,
                avatarUrl=m.avatarUrl,
                sessionCount=st.total if st else 0,
                avgScore=round(float(st.avg), 1) if (st and st.avg) else None,
                sessionsThisWeek=week_map.get(m.id, 0),
                lastSessionAt=st.last_at if st else None,
            ))
        summaries.sort(key=lambda x: (x.avgScore or 0), reverse=True)

        manager_extra = ManagerDashboardExtra(teamSize=len(summaries), members=summaries)

    return DashboardResponse(
        totalSessions=total_sessions,
        avgScore=avg_score,
        activeUsers=active_users,
        passRate=pass_rate,
        frameworkStats=framework_stats,
        recentSessions=recent_sessions,
        agentExtra=agent_extra,
        managerExtra=manager_extra,
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(
    current_user: CurrentUser,
    db: DB,
    period: str = Query("all", pattern="^(all|month)$"),
):
    filters = [Session.companyId == current_user.companyId]
    if period == "month":
        month_ago = datetime.now(timezone.utc) - timedelta(days=30)
        filters.append(Session.createdAt >= month_ago)

    result = await db.execute(
        select(
            Session.userId,
            func.avg(Session.totalScore).label("avg_score"),
            func.count(Session.id).label("session_count"),
        )
        .where(*filters, Session.totalScore.isnot(None))
        .group_by(Session.userId)
        .order_by(func.avg(Session.totalScore).desc())
        .limit(20)
    )
    rows = result.all()
    if not rows:
        return []

    user_ids = [r.userId for r in rows]
    user_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u for u in user_result.scalars().all()}

    entries = []
    for rank, row in enumerate(rows, 1):
        u = users_map.get(row.userId)
        if not u:
            continue
        entries.append(LeaderboardEntry(
            rank=rank,
            user=LeaderboardUser(id=u.id, firstName=u.firstName, lastName=u.lastName, avatarUrl=u.avatarUrl),
            avgScore=round(float(row.avg_score), 1),
            sessionCount=row.session_count,
        ))
    return entries
