# Interview feedback, scheduling and rejection email

Interviewers use the application’s **Interview feedback** section to submit
their own assessment. Admins and Recruiters can save a rubric per job and assign
active job interviewers. Rubric edits apply to future application rounds.
Interviewers can resume their draft. Submitted scorecards are final, with
clarifications available through the normal application notes. Admins, Recruiters
and the assigned Hiring Manager see progress and submitted responses. Closing the
job pauses rubric and feedback edits. Reopening lets pending work continue.

In **Interviews**, an Admin or Recruiter can record an agreed time for one assigned
interviewer. The app stores the time as a UTC instant and displays the booking’s
IANA time zone. It checks overlapping bookings recorded in Morrow and keeps a
dated record of rescheduling and cancellation. Use **Copy interview details** to
share the current details manually. Morrow has no connected calendar or automated
invite delivery.

## Optional rejection email

The existing pipeline can reject an application without email. To enable the
separate email workflow, the deployment operator sets both server-side values.

- `MORROW_RESEND_API_KEY` is a Resend key with sending access. Store it as a deployment secret.
- `MORROW_EMAIL_FROM` is an email address on a verified domain that the operator controls.

Admins and Recruiters can prepare a decision for one application, review the
stored message and explicitly dispatch it. Restoring the application cancels
unclaimed email. The application distinguishes provider acceptance, definite
failure, and an uncertain outcome. A definite failure permits an explicit retry.
For an uncertain outcome, check the provider dashboard. The in-app history
contains the exact submission time and, following provider acceptance, the
provider’s message ID. Verify delivery via your own test inbox when configuring a
sender. Automated sends, bulk sends, webhooks and inbox sync are outside this
workflow.

See the Resend [send API](https://resend.com/docs/api-reference/emails/send-email)
and [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)
documentation. Deployment and test credentials belong outside Git.
