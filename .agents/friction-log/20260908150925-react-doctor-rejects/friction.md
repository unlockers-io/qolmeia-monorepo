---
title: "React Doctor rejects an unconditional preventDefault when the submit handler branches"
severity: "minor"
target: "react-doctor"
---

React Doctor 0.9.13 flags the login submit handler despite event.preventDefault running unconditionally before the magic-link/password branch. Inspection of the rule confirms its definite-prevention check rejects any control-flow node anywhere in the handler. Keep DOM cancellation in a straight-line adapter and dispatch the selected login method separately; regression tests explicitly assert defaultPrevented for both methods. No rule suppression is needed.
