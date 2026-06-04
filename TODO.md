# Permission Cleanup & Simplification - TODO

## Plan checklist
- [ ] Implement DB migration script: legacy CRUD -> VIEW/MANAGE mapping
- [ ] Safe migration: update/move `account_permissions` without duplicates
- [ ] Delete legacy `permission` rows after migration
- [ ] Verification script/report output (counts + sanity checks)
- [ ] Update frontend PermissionManagement page to hide legacy permissions (optional but requested)
- [ ] Run dry-run, then apply
- [ ] Backend/frontend checks: ensure no access loss and menu still works

