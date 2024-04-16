from datetime import timedelta, datetime, UTC
from functools import wraps
from flask import Flask, jsonify, render_template, request, session, redirect, url_for
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from dataclasses import dataclass
from cas import CASClient
from dotenv import load_dotenv
import os

load_dotenv()
BASE_URL = os.getenv("BASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY")
CAS_URL = os.getenv("CAS_URL")
EXTENSION_ID = os.getenv("EXTENSION_ID")
DATABASE_URI = os.getenv("DATABASE_URI")
USER_ID_KEY = "user_id"


class Base(DeclarativeBase):
    pass


app = Flask(__name__)
CORS(app, origins=[BASE_URL, EXTENSION_ID], supports_credentials=True)
app.secret_key = SECRET_KEY
app.permanent_session_lifetime = timedelta(days=30)
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_NAME="crowdsource_session",
    SQLALCHEMY_DATABASE_URI=DATABASE_URI,
)
app.static_folder = "static"

db = SQLAlchemy(model_class=Base)
db.init_app(app)


@dataclass
class DeadlineSubmissions(db.Model):
    user_id: int
    course_id: int
    assignment_id: int
    deadline: datetime
    created_at: datetime
    updated_at: datetime

    user_id: Mapped[Integer] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[Integer] = mapped_column(Integer, primary_key=True)
    assignment_id: Mapped[Integer] = mapped_column(Integer, primary_key=True)
    deadline: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


@dataclass
class Deadlines(db.Model):
    course_id: int
    assignment_id: int
    deadline: datetime

    course_id: Mapped[Integer] = mapped_column(Integer, primary_key=True)
    assignment_id: Mapped[Integer] = mapped_column(Integer, primary_key=True)
    deadline: Mapped[datetime] = mapped_column(DateTime, nullable=False)

@dataclass
class UnverifiedDeadlines(db.Model):
    course_id: int
    assignment_id: int
    deadline: datetime

    course_id: Mapped[Integer] = mapped_column(Integer, primary_key=True)
    assignment_id: Mapped[Integer] = mapped_column(Integer, primary_key=True)
    deadline: Mapped[datetime] = mapped_column(DateTime, nullable=False)

@dataclass
class CourseHeadcountSubmissions(db.Model):
    user_id: int
    course_id: int
    headcount: int
    created_at: datetime
    updated_at: datetime

    user_id: Mapped[Integer] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[Integer] = mapped_column(Integer, primary_key=True)
    headcount: Mapped[Integer] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


@dataclass
class CourseHeadcounts(db.Model):
    course_id: int
    headcount: int

    course_id: Mapped[Integer] = mapped_column(Integer, primary_key=True)
    headcount: Mapped[Integer] = mapped_column(Integer, nullable=False)

@dataclass
class UnverifiedCourseHeadcounts(db.Model):
    course_id: int
    headcount: int

    course_id: Mapped[Integer] = mapped_column(Integer, primary_key=True)
    headcount: Mapped[Integer] = mapped_column(Integer, nullable=False)

with app.app_context():
    db.create_all()

cas_client = CASClient(
    version=3,
    service_url=f"{BASE_URL}/login?next=/welcome",
    server_url=CAS_URL,
)


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if USER_ID_KEY not in session:
            return jsonify(error="Login required"), 403
        return f(*args, **kwargs)

    return decorated_function


@app.route("/")
def index():
    return redirect(url_for("login"))


@app.get("/profile")
@login_required
def profile():
    return jsonify(user_id=session[USER_ID_KEY])


@app.get("/welcome")
@login_required
def welcome():
    return render_template("welcome.html", user_id=session[USER_ID_KEY])


@app.get('/privacy-policy')
def privacy_policy():
    return render_template('privacy_policy.html')

@app.get("/login")
def login():
    if USER_ID_KEY in session:
        return redirect(url_for("profile"))

    next = request.args.get("next")
    ticket = request.args.get("ticket")
    if not ticket:
        cas_login_url = cas_client.get_login_url()
        return redirect(cas_login_url)

    user, attributes, pgtiou = cas_client.verify_ticket(ticket)
    if not user:
        return render_template("login_failed.html"), 401
    else:
        print(attributes)
        session[USER_ID_KEY] = int(attributes["RollNo"])
        session.permanent = True
        return redirect(next)


@app.get("/logout")
def logout():
    session.pop(USER_ID_KEY, None)
    return render_template("logout.html")


@app.get("/courses/<course_id>/headcount")
@login_required
def get_course_headcount(course_id: int):
    course_headcount: CourseHeadcounts = CourseHeadcounts.query.filter_by(
        course_id=course_id
    ).first()
    headcount = course_headcount.headcount if course_headcount else None
    last_submission: CourseHeadcountSubmissions = (
        CourseHeadcountSubmissions.query.filter_by(
            user_id=session[USER_ID_KEY], course_id=course_id
        )
        .order_by(CourseHeadcountSubmissions.updated_at.desc())
        .first()
    )
    last_submitted_headcount = last_submission.headcount if last_submission else None
    return jsonify(
        course_id=course_id,
        headcount=headcount,
        last_submitted_headcount=last_submitted_headcount,
    )


@app.post("/courses/<course_id>/headcount")
@login_required
def add_course_headcount(course_id: int):
    past_submission: CourseHeadcountSubmissions = (
        CourseHeadcountSubmissions.query.filter_by(
            user_id=session[USER_ID_KEY], course_id=course_id
        ).first()
    )
    if past_submission:
        past_submission.headcount = request.json["headcount"]
        db.session.commit()
    else:
        new_submission = CourseHeadcountSubmissions(
            user_id=session[USER_ID_KEY],
            course_id=course_id,
            headcount=request.json["headcount"],
        )
        db.session.add(new_submission)
        db.session.commit()
    submissions: list[CourseHeadcountSubmissions] = (
        CourseHeadcountSubmissions.query.filter_by(course_id=course_id)
        .order_by(CourseHeadcountSubmissions.updated_at.desc())
        .limit(5)
        .all()
    )
    if (
        len(submissions) >= 5
        and len(set([submission.headcount for submission in submissions])) == 1
    ):
        course_headcount: CourseHeadcounts = CourseHeadcounts.query.filter_by(
            course_id=course_id
        ).first()
        course_headcount.headcount = submissions[0].headcount
        db.session.commit()
    unverified_course_headcount: UnverifiedCourseHeadcounts = UnverifiedCourseHeadcounts.query.filter_by(
        course_id=course_id
    ).first()
    if unverified_course_headcount:
        unverified_course_headcount.headcount = request.json["headcount"]
        db.session.commit()
    else:
        new_unverified_headcount = UnverifiedCourseHeadcounts(
            course_id=course_id,
            headcount=request.json["headcount"],
        )
        db.session.add(new_unverified_headcount)
        db.session.commit()
    return jsonify(message="success")


@app.get("/courses/<course_id>/assignments/<assignment_id>/deadline")
@login_required
def get_deadline(course_id: int, assignment_id: int):
    deadline: Deadlines = Deadlines.query.filter_by(
        course_id=course_id, assignment_id=assignment_id
    ).first()
    deadline = deadline.deadline if deadline else None
    last_submission: DeadlineSubmissions = (
        DeadlineSubmissions.query.filter_by(
            user_id=session[USER_ID_KEY],
            course_id=course_id,
            assignment_id=assignment_id,
        )
        .order_by(DeadlineSubmissions.updated_at.desc())
        .first()
    )
    last_submitted_deadline = last_submission.deadline if last_submission else None
    return jsonify(
        course_id=course_id,
        assignment_id=assignment_id,
        deadline=deadline,
        last_submitted_deadline=last_submitted_deadline,
    )


@app.post("/courses/<course_id>/assignments/<assignment_id>/deadline")
@login_required
def add_deadline(course_id: int, assignment_id: int):
    deadline = datetime.fromtimestamp(request.json["deadline"] / 1000, tz=UTC)
    past_submission: DeadlineSubmissions = DeadlineSubmissions.query.filter_by(
        user_id=session[USER_ID_KEY], course_id=course_id, assignment_id=assignment_id
    ).first()
    if past_submission:
        past_submission.deadline = deadline
        db.session.commit()
    else:
        new_submission = DeadlineSubmissions(
            user_id=session[USER_ID_KEY],
            course_id=course_id,
            assignment_id=assignment_id,
            deadline=deadline,
        )
        db.session.add(new_submission)
        db.session.commit()
    submissions: list[DeadlineSubmissions] = (
        DeadlineSubmissions.query.filter_by(
            course_id=course_id, assignment_id=assignment_id
        )
        .order_by(DeadlineSubmissions.updated_at.desc())
        .limit(5)
        .all()
    )
    if (
        len(submissions) >= 5
        and len(set([submission.deadline for submission in submissions])) == 1
    ):
        deadline: Deadlines = Deadlines.query.filter_by(
            course_id=course_id, assignment_id=assignment_id
        ).first()
        deadline.deadline = submissions[0].deadline
        db.session.commit()
    unverified_deadline: UnverifiedDeadlines = UnverifiedDeadlines.query.filter_by(
        course_id=course_id, assignment_id=assignment_id
    ).first()
    if unverified_deadline:
        unverified_deadline.deadline = deadline
        db.session.commit()
    else:
        new_unverified_deadline = UnverifiedDeadlines(
            course_id=course_id,
            assignment_id=assignment_id,
            deadline=deadline,
        )
        db.session.add(new_unverified_deadline)
        db.session.commit()
    return jsonify(message="success")

@app.get('/deadlines/verified')
def get_all_verified_deadlines():
    deadlines: list[Deadlines] = Deadlines.query.all()
    course_headcounts: list[CourseHeadcounts] = CourseHeadcounts.query.all()
    headcount_dict = {}
    for course_headcount in course_headcounts:
        headcount_dict[course_headcount.course_id] = course_headcount.headcount
    heatmap = []
    max_headcount = 0
    date_headcounts_dict = {}
    for deadline in deadlines:
        course_id = deadline.course_id
        headcount = headcount_dict.get(course_id, 0)
        for offset in range(-5, 1):
            date_offset = (deadline.deadline + timedelta(days=offset)).strftime('%Y-%m-%d')
            date_headcounts_dict[date_offset] = date_headcounts_dict.get(date_offset, 0) + headcount * (6 - abs(offset)) / 6
            max_headcount = max(max_headcount, date_headcounts_dict[date_offset])
    for date, headcount in date_headcounts_dict.items():
        heatmap.append({
            'date': date,
            'headcount': headcount
        })
    return jsonify(heatmap=heatmap, max_headcount=max_headcount)

@app.get('/deadlines/unverified')
def get_all_unverified_deadlines():
    deadlines: list[UnverifiedDeadlines] = UnverifiedDeadlines.query.all()
    course_headcounts: list[UnverifiedCourseHeadcounts] = UnverifiedCourseHeadcounts.query.all()
    headcount_dict = {}
    for course_headcount in course_headcounts:
        headcount_dict[course_headcount.course_id] = course_headcount.headcount
    heatmap = []
    max_headcount = 0
    date_headcounts_dict = {}
    for deadline in deadlines:
        course_id = deadline.course_id
        headcount = headcount_dict.get(course_id, 0)
        for offset in range(-5, 1):
            date_offset = (deadline.deadline + timedelta(days=offset)).strftime('%Y-%m-%d')
            date_headcounts_dict[date_offset] = date_headcounts_dict.get(date_offset, 0) + headcount * (6 - abs(offset)) / 6
            max_headcount = max(max_headcount, date_headcounts_dict[date_offset])
    for date, headcount in date_headcounts_dict.items():
        heatmap.append({
            'date': date,
            'headcount': headcount
        })
    return jsonify(heatmap=heatmap, max_headcount=max_headcount)

app.run(port=9999, debug=True)
