# Nurse License Monitor

Standalone Windows desktop app for reading an Excel workbook and sending reminder messages for nurse licenses or documents that are expired or close to expiring.

## Start

Double-click:

```text
Start App.cmd
```

The first run creates a local Python environment and installs the Excel reader. After that, the app opens directly.

If the window does not open, double-click:

```text
Run In Console.cmd
```

That keeps the console open so any error is visible.

## Excel Columns

The app auto-detects common column names. Recommended headers:

```text
Nurse Name
Email
Email to SMS
Document Type
Expiration Date
```

It also understands common variations such as `Name`, `Employee Name`, `License Type`, `Expires`, `Expiry Date`, and `SMS Email`.

## Reminder Rules

- Expired: up to 3 messages per day
- Less than 15 days: up to 2 messages per day
- Less than 30 days: up to 1 message per day
- Less than 60 days: up to 2 messages per week
- Less than 90 days: up to 3 messages per month

The app checks every hour while it is open. Use **Send Due Now** to run immediately.

## Sending Email and Email-to-SMS

Email-to-SMS works by sending an email to a carrier SMS gateway address, for example:

```text
3015551234@vtext.com
3015551234@txt.att.net
3015551234@tmomail.net
```

SMTP settings are saved locally in:

```text
settings.json
```

Send history is saved locally in:

```text
send_history.json
```
