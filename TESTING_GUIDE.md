# Multi-Tenant Portal - Quick Start Testing Guide

## 🚀 Getting Started

### Prerequisites
- Backend running on http://localhost:3001
- Frontend running on http://localhost:5173
- Logged in as IITECH_ADMIN user
- Database seeded with admin user

### Step 1: Navigate to Tenants Page
```
URL: http://localhost:5173/tenants
```

You should see:
- "Tenants Management" heading
- Stats cards showing Total Tenants, Total Users, Total Rooms
- Empty table or list of existing tenants
- "Create Tenant" button in top right

---

## 📋 Test Scenario 1: Complete Successful Creation

### Step 1.1 - Click "Create Tenant"
- Modal appears with progress indicator (1/4)
- Progress shows step 1: Details, 2: Owner, 3: Review, 4: Success

### Step 1.2 - Fill Tenant Details (Step 1)
```
Tenant Name: "Grand Hotel"
Slug: "grand-hotel"  
→ Type a few characters and watch for:
  - Auto-formatting (removes special chars)
  - Slug availability check (green checkmark if available)
  - Loading spinner while checking

Email: "contact@grandhotel.com"
Phone: "+1 (555) 123-4567" (optional)
Address: "123 Main Street, Downtown" (optional)
```

### Step 1.3 - Click "Next"
- Validates step 1
- Shows any errors next to affected fields
- If valid, proceeds to Step 2 (Owner Account)
- Progress indicator updates to 2/4

### Step 1.4 - Fill Owner Account (Step 2)
```
Owner Email: "owner@grandhotel.com"
First Name: "John"
Last Name: "Doe"
Password: "MySuperSecure123!"
→ Watch for:
  - Password strength meter:
    "Weak" (0-5 chars)
    "Medium" (6-11 chars)
    "Strong" (12+ chars)
```

### Step 1.5 - Click "Next"
- Validates step 2
- Shows any errors (required fields, weak password)
- If valid, proceeds to Step 3 (Review)
- Progress indicator updates to 3/4

### Step 1.6 - Review Details (Step 3)
You should see all entered information in a read-only format:
```
Tenant Name: Grand Hotel
Slug: grand-hotel
Email: contact@grandhotel.com
Phone: +1 (555) 123-4567
Address: 123 Main Street, Downtown

Owner Account:
Email: owner@grandhotel.com
Name: John Doe
```

### Step 1.7 - Click "Create Tenant"
- Button shows "Creating..." with spinner
- Form inputs disabled
- Wait for response (should be < 500ms)

### Step 1.8 - Success Screen (Step 4)
You should see:
```
✓ (Green checkmark icon)
Tenant Created Successfully!

The tenant "Grand Hotel" has been created and is ready to use.

Next Steps:
1. Share the owner login with: owner@grandhotel.com
2. Owner should log in and complete the onboarding wizard
3. Add initial room categories and rate plans
4. Invite staff members to the tenant
5. Configure payment settings and integrations

Tenant Slug: grand-hotel
[Done] button
```

### Step 1.9 - Click "Done"
- Modal closes
- Tenant list refreshes
- "Grand Hotel" should now appear in the table with:
  - Name: Grand Hotel
  - Slug: grand-hotel
  - Email: contact@grandhotel.com
  - Status: active (green badge)
  - Users: 1 (the owner)
  - Rooms: 0 (not yet added)

---

## ⚠️ Test Scenario 2: Validation Errors

### Test 2.1 - Duplicate Slug
```
1. Start new tenant creation
2. Step 1: Use "grand-hotel" (from Scenario 1)
3. Slug field should show red error:
   "Slug 'grand-hotel' is already taken. Try 'grand-hotel-2' or similar."
4. Red X indicator next to slug input
5. "Next" button remains clickable but validation prevents submission
```

### Test 2.2 - Invalid Email
```
1. Step 1: Enter "contact.grandhotel.com" (missing @)
2. Should show error: "Invalid email"
3. Try valid email and error clears
```

### Test 2.3 - Weak Password
```
1. Step 2: Enter Password: "123"
2. Password strength shows: "Weak"
3. Try "SecurePass123"
4. Password strength shows: "Strong"
```

### Test 2.4 - Required Fields
```
1. Step 1: Leave "Tenant Name" empty
2. Click "Next"
3. Shows red error: "Tenant name is required"
4. Fill field and try again
```

### Test 2.5 - Invalid Slug Format
```
1. Step 1: Enter Slug: "Grand Hotel"
2. Should auto-format to: "grand-hotel"
3. Try: "grand_hotel"
4. Should auto-format to: "grandhhotel" (underscores removed)
```

---

## 🔄 Test Scenario 3: Multi-Step Navigation

### Test 3.1 - Back Button
```
1. Step 2: Fill owner details
2. Click "Back" button
3. Returns to Step 1 (Details)
4. All previous data is preserved
5. Click "Next" to return to Step 2
6. Owner data is still there
```

### Test 3.2 - Review and Edit
```
1. Fill Steps 1-2 with sample data
2. Go to Step 3 (Review)
3. Click "Back"
4. Returns to Step 2
5. Edit owner name to something else
6. Click "Next" twice to get back to Step 3
7. Review shows updated owner name
```

---

## 📊 Test Scenario 4: Backend Validation

### Test 4.1 - Duplicate Owner Email
```
1. Create first tenant with owner: owner@test.com
2. Create second tenant with same owner email
3. Should get error:
   {
     "code": "DUPLICATE_OWNER_EMAIL",
     "message": "Email 'owner@test.com' is already registered as a user.",
     "field": "ownerEmail"
   }
```

### Test 4.2 - API Error Response Format
From browser DevTools Network tab, check POST /api/tenants response:
```
Success (201):
{
  "success": true,
  "data": { tenant: {...}, owner: {...} },
  "message": "Tenant created successfully..."
}

Error (400):
{
  "success": false,
  "error": {
    "code": "DUPLICATE_SLUG",
    "message": "Slug 'grand-hotel' is already...",
    "field": "slug",
    "suggestion": "Try 'grand-hotel-2025'..."
  }
}
```

---

## 🔍 Verification Checklist

### Frontend
- [ ] Create Tenant button visible in header
- [ ] Modal opens with Step 1/4
- [ ] Progress indicator shows current step
- [ ] Form fields have proper alignment
- [ ] Slug availability checked in real-time
- [ ] Password strength meter works
- [ ] Validation errors display inline
- [ ] Back/Next buttons navigate correctly
- [ ] Review step shows all data
- [ ] Success screen appears on successful creation
- [ ] Tenant list auto-refreshes
- [ ] New tenant appears in table
- [ ] Error messages are user-friendly

### Backend
- [ ] POST /api/tenants creates tenant in database
- [ ] GET /api/tenants/check-slug/:slug works
- [ ] Duplicate slug returns correct error code
- [ ] Duplicate owner email returns correct error code
- [ ] Owner user is created with correct role
- [ ] Tenant status is "active" by default
- [ ] Audit log entry is created
- [ ] Default data is seeded (optional, check DB):
  - [ ] 3 room categories created
  - [ ] 3 rate plans created
  - [ ] 3 shifts created
  - [ ] Overbooking settings created
  - [ ] Loyalty program created

### Integration
- [ ] API response time < 500ms
- [ ] No console errors (DevTools)
- [ ] No network errors
- [ ] Loading states work properly
- [ ] Toast notifications appear for errors
- [ ] Success toast appears on creation
- [ ] Modals close smoothly
- [ ] Data persists on page refresh

---

## 🐛 Known Edge Cases to Test

### Test 5.1 - Network Failure During Creation
```
1. Start tenant creation
2. Before hitting Create, slow down network (DevTools → Network → Slow 3G)
3. Hit Create Tenant
4. See loading state persist
5. Observe timeout behavior
6. Check error message is helpful
```

### Test 5.2 - Token Expiration
```
1. Start creating tenant
2. Wait for token to expire (or manually clear localStorage)
3. Try to submit form
4. Should redirect to login gracefully
```

### Test 5.3 - Concurrent Creation
```
1. Start two tenant creations simultaneously
2. Use unique slugs
3. Both should complete successfully (or fail gracefully)
4. Both should appear in list
```

---

## 📱 Browser Testing

Test in multiple browsers:
- ✅ Chrome/Edge (Chromium-based)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile Safari (iPad)
- ✅ Chrome Mobile

Check:
- Form alignment on small screens
- Touch targets are large enough
- Modal doesn't hide content
- Progress indicator is visible
- All buttons are clickable

---

## 🔐 Security Tests

### Test 6.1 - Non-Admin Access
```
1. Log in as non-admin user
2. Navigate to /tenants
3. Should redirect to /dashboard
4. Error message: "Access denied. Admin privileges required."
```

### Test 6.2 - XSS Prevention
```
1. Step 1: Tenant Name: "<script>alert('xss')</script>"
2. Should not execute script
3. Should either strip or encode dangerous characters
```

### Test 6.3 - Slug Injection
```
1. Step 1: Slug: "'; DROP TABLE tenants; --"
2. Should format to: "drop-table-tenants"
3. Should not execute SQL
```

---

## 📈 Performance Monitoring

Open DevTools → Performance tab:

### Test 7.1 - Slug Availability Check
- Network request < 50ms
- No loading delays
- Debounced properly (check multiple requests)

### Test 7.2 - Tenant Creation
- Initial load < 200ms
- Tenant creation < 500ms
- List refresh < 300ms

### Test 7.3 - Memory
- Modal close releases memory properly
- No memory leaks after multiple creations
- Component unmounts cleanly

---

## ✅ Final Checklist Before Production

- [ ] All test scenarios pass
- [ ] No console errors or warnings
- [ ] No network errors
- [ ] Mobile friendly
- [ ] Accessibility tested (keyboard navigation)
- [ ] Error messages are helpful
- [ ] Loading states are visible
- [ ] Performance is acceptable
- [ ] Security tests pass
- [ ] Tenant data persists correctly
- [ ] List updates automatically
- [ ] Default data seeded correctly
- [ ] Audit logs created
- [ ] Cache invalidation working

---

## 🆘 Troubleshooting

### Issue: Slug checker doesn't work
**Debug**:
- Check browser console for errors
- Verify API endpoint exists: GET /api/tenants/check-slug/:slug
- Check auth token is valid
- Slow down network to see loading state

### Issue: Tenant creation fails silently
**Debug**:
- Check Network tab in DevTools
- Look for 400/500 response
- Check error response format
- Verify database connection
- Check server logs

### Issue: List doesn't update after creation
**Debug**:
- Check that refresh is called after success
- Verify GET /api/tenants endpoint works
- Check network response
- Clear browser cache and retry

### Issue: Form validation doesn't trigger
**Debug**:
- Check that schema validation is running
- Look for error state in React DevTools
- Verify form fields are properly bound
- Check console for validation errors

---

## 📞 Support

If tests fail:
1. Check browser console (F12 → Console tab)
2. Check network requests (F12 → Network tab)
3. Check server logs
4. Review error message code (e.g., DUPLICATE_SLUG)
5. Check documentation in MULTI_TENANT_IMPLEMENTATION.md
