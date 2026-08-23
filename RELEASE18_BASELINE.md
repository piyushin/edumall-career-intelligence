# The EduMall Career Intelligence - Release 18

Base commit:
e36da22b89565f53985208c4a517d151da1f6906

Production baseline:
Release 17 + landing1

Release 18 scope:

1. Candidate result status
2. Assessment/report pricing
3. Coupon system
4. Orders
5. Payments
6. Sponsored/manual approvals
7. Report entitlement
8. Candidate report unlock
9. Counselling package option
10. Audit trail

Safety rules:

- No database reset
- No destructive migration
- Payment does not generate psychometric results
- Payment/coupon grants entitlement only
- Existing scoring pipeline remains unchanged
- Existing governed report snapshot remains unchanged
- Existing report release workflow remains unchanged
- Every manual commercial override must be audited
