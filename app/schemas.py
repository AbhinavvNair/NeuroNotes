from pydantic import BaseModel, EmailStr, field_validator, ConfigDict
from datetime import datetime


# User Schemas

class UserCreate(BaseModel):
    email: EmailStr
    password: str

    @field_validator('password')
    @classmethod
    def password_min_length(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def new_password_min_length(cls, v):
        if len(v) < 8:
            raise ValueError('New password must be at least 8 characters')
        return v


# Note Schemas

class NoteCreate(BaseModel):
    title: str | None = None
    content: str


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


class NoteResponse(BaseModel):
    id: int
    title: str | None
    content: str
    created_at: datetime
    is_bookmarked: bool

    model_config = ConfigDict(from_attributes=True)


# Flashcard Schemas

class FlashcardDeckCreate(BaseModel):
    topic: str
    difficulty: str
    cards: list[dict]


class FlashcardDeckResponse(BaseModel):
    id: int
    topic: str
    difficulty: str
    count: int
    cards: list[dict]
    saved_at: str

    model_config = ConfigDict(from_attributes=True)
