# Make the Receive Payment dialog scrollable

## Problem

The Monthly pay popup in the Process menu is taller than the screen (value date, fine-window breakdown, editable Base/Penalty, mode, Payment Complete tick). The dialog has no scroll behaviour, so the Confirm button sits below the viewport and can't be clicked.

## Fix

In `src/components/bus/ReceivePaymentDialog.tsx`:

- Cap the dialog height: add `max-h-[90vh]` to `DialogContent` and make it a flex column with fixed header and footer.
- Make the middle content area scrollable (`flex-1 overflow-y-auto`) so the header (student/month) and footer (Cancel / Confirm buttons) stay pinned and always visible, while the fields in between scroll.

No logic changes — only layout classes on the existing dialog. The same fix automatically helps the Settlement and Advance views when they are tall.
