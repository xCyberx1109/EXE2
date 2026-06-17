export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
}

export interface WelcomeEmailPayload {
  email: string;
  fullName: string;
}

export interface InviteEmailPayload {
  email: string;
  fullName: string;
  inviteLink: string;
}

export interface PasswordResetEmailPayload {
  email: string;
  fullName: string;
  inviteLink: string;
}

export interface CredentialsEmailPayload {
  email: string;
  fullName: string;
  password: string;
}
