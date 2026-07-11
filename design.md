# Dream Auto-Loan CRM - Interface Design & User Flows

## Overview
A comprehensive CRM system for managing auto sales and installment financing. The app supports Web, Android, and iOS with role-based access control for Sales Managers, Team Leaders, Sales Representatives, and Moderators.

---

## Screen List & Navigation Structure

### 1. Authentication Screens
- **Login Screen** - Email/password or OAuth login
- **Role Selection Screen** - (Optional) If user has multiple roles

### 2. Sales Representative Screens
- **Home/Dashboard** - Quick stats, today's follow-ups, recent customers
- **My Customers** - List of assigned customers with status filters
- **Customer Detail** - Full customer profile, notes history, follow-ups
- **Add/Edit Customer** - Create new lead or edit existing customer
- **Sales Notes** - Add call notes, WhatsApp messages, meeting notes
- **Schedule Follow-up** - Set follow-up date and reason
- **My Follow-ups** - Today's and upcoming follow-ups
- **Installment Status** - View installment application status
- **Lost Deals** - View closed/lost deals (read-only for sales)

### 3. Team Leader Screens
- **Dashboard** - Team performance, customer distribution, conversion metrics
- **Team Management** - Assign customers to sales reps, reassign customers
- **Add New Customer** - Create leads for the team
- **All Customers** - View all team customers with advanced filters
- **Customer Reassignment** - Transfer customer from one sales rep to another
- **Team Reports** - Performance metrics, follow-up completion rates
- **Lost Deals Management** - Review and manage lost deals

### 4. Sales Manager Screens
- **Executive Dashboard** - Company-wide metrics, KPIs, conversion funnels
- **All Customers** - Global customer view with filters
- **Sales Team Performance** - Individual and team metrics
- **Add Sales Rep** - Onboard new sales representatives
- **Installment Analytics** - Financing approval rates by partner
- **Lost Deals Repository** - All lost deals for re-engagement or exclusion
- **Reports & Analytics** - Detailed reports on all metrics
- **Settings** - Company settings, installment partners

### 5. Moderator Screens
- **Facebook Leads Import** - View and import leads from Meta Ads
- **Manual Lead Entry** - Add leads from external calls or referrals
- **Duplicate Detection** - Review and merge duplicate customers
- **Lead Distribution** - Assign leads to sales reps (if enabled)

---

## Primary Content & Functionality by Screen

### Sales Rep - Home/Dashboard
**Content:**
- Quick stats: Total customers, qualified leads, active follow-ups
- Today's follow-ups (list with customer names, phone numbers)
- Recent activities (last 5 interactions)
- Quick action buttons: Add customer, View follow-ups, View customers

**Functionality:**
- Tap follow-up to open customer detail
- Tap "Add Customer" to create new lead
- Tap "View Customers" to see full list
- Receive WhatsApp notification at start of day with today's follow-ups

### Sales Rep - Customer Detail
**Content:**
- Customer info: Name, phone, email, source
- Status badge: New Lead, Qualified, In Progress, Sales Opportunity, Closed
- Interest level: Interested, Thinking, Not Interested
- Timeline of all notes (call, WhatsApp, email, meeting)
- Follow-up history with dates and outcomes
- Installment application status (if applicable)
- Sales opportunity details (if applicable)

**Functionality:**
- Add new sales note (call, WhatsApp, email, meeting)
- Update qualification status
- Schedule follow-up
- View installment status
- Reassign customer (Team Leader only)
- Close customer (lost deal)

### Sales Rep - Sales Notes
**Content:**
- Note type selector: Call, WhatsApp, Email, Meeting, Follow-up
- Note text area
- Outcome selector: Interested, Thinking, Not Interested, Qualified, Unqualified
- Timestamp (auto-filled)

**Functionality:**
- Save note
- Auto-update customer status based on outcome
- Trigger follow-up creation if needed

### Sales Rep - Schedule Follow-up
**Content:**
- Customer name (display)
- Date picker (calendar)
- Time picker (optional)
- Reason selector: Follow-up call, Send documents, Check status, etc.
- Notes field

**Functionality:**
- Save follow-up
- Set reminder notification
- Auto-send WhatsApp reminder on scheduled date

### Sales Rep - My Follow-ups
**Content:**
- Segmented tabs: Today, Upcoming, Completed, Overdue
- List of follow-ups with customer name, phone, scheduled date
- Status badge

**Functionality:**
- Tap to open customer detail
- Mark as completed
- Reschedule
- Cancel

### Team Leader - Dashboard
**Content:**
- Team performance metrics:
  - Total customers assigned
  - Qualified leads count
  - Conversion rate (leads to sales opportunities)
  - Active follow-ups
  - Completed follow-ups (today, this week, this month)
- Sales rep performance cards (name, customer count, conversion rate, follow-up completion)
- Customer distribution pie chart

**Functionality:**
- Tap sales rep card to view their customers
- Tap metric to drill down
- Assign new customers to team members

### Team Leader - Assign Customer
**Content:**
- Customer name and details
- List of available sales reps with their current load
- Confirmation dialog

**Functionality:**
- Select sales rep
- Confirm assignment
- Auto-notify sales rep

### Sales Manager - Executive Dashboard
**Content:**
- KPI cards:
  - Total customers
  - Qualified leads
  - Sales opportunities
  - Closed deals (this month)
  - Conversion rate (lead to sale)
  - Average deal value
- Charts:
  - Customer status distribution (pie chart)
  - Conversion funnel (bar chart)
  - Monthly sales trend (line chart)
  - Installment approval rate by partner (bar chart)
- Top performers (sales reps by deals closed)
- Recent lost deals (last 10)

**Functionality:**
- Tap any metric to drill down
- Date range selector (This Month, Last 3 Months, This Year, Custom)
- Export reports to PDF/Excel

### Sales Manager - Lost Deals Repository
**Content:**
- Table/List of all lost deals with:
  - Customer name
  - Phone
  - Reason for loss
  - Reason category
  - Sales rep who closed
  - Date closed
- Filters: Reason category, date range, sales rep
- Search by customer name/phone

**Functionality:**
- View customer detail
- Re-engage customer (move back to active)
- Mark as permanently excluded
- Export list

### Moderator - Facebook Leads Import
**Content:**
- List of new leads from Meta Ads Manager
- Lead details: Name, phone, email, ad campaign
- Duplicate detection indicator
- Status: New, Assigned, Skipped

**Functionality:**
- Review lead details
- Check for duplicates (by phone number)
- Assign to sales rep
- Skip/reject lead
- Bulk import

---

## Key User Flows

### Flow 1: Sales Rep Receives New Lead
1. Moderator imports lead from Facebook or enters manually
2. System checks for duplicates (by phone)
3. Team Leader assigns lead to sales rep
4. Sales rep receives notification
5. Sales rep views customer detail
6. Sales rep adds first note (call/WhatsApp outcome)
7. Sales rep schedules follow-up or marks as unqualified

### Flow 2: Customer Moves to Sales Opportunity
1. Sales rep receives installment documents from customer
2. Sales rep creates installment application
3. Sales rep selects financing partner (Drive, Contact, Aman, etc.)
4. System moves customer to "Sales Opportunity" status
5. Sales rep tracks installment status (Submitted, Pending, Approved, Rejected)
6. If approved, sales rep schedules inspection (used car) or quote (new car)
7. After inspection/quote, sales rep schedules contract signing

### Flow 3: Deal Closure
1. Customer signs contract
2. Customer completes registration/licensing
3. Sales rep marks opportunity as "Completed"
4. System records deal as closed/won
5. Sales Manager can view in reports

### Flow 4: Deal Lost
1. Sales rep determines customer is not interested or deal is rejected
2. Sales rep closes customer with reason (Financing rejected, Found competitor, etc.)
3. System moves customer to "Closed Lost"
4. Deal appears in Lost Deals repository
5. Sales Manager can re-engage or exclude customer

### Flow 5: Team Leader Reassigns Customer
1. Team Leader views team customers
2. Identifies customer to reassign
3. Selects new sales rep
4. Confirms reassignment
5. Old sales rep loses access
6. New sales rep receives notification
7. All notes history transferred

### Flow 6: Daily WhatsApp Follow-up Reminder
1. System identifies all customers with follow-ups scheduled for today
2. Groups by sales rep
3. At 8:00 AM, sends WhatsApp message to each sales rep with:
   - List of customer names
   - Phone numbers
   - Follow-up reason
4. Sales rep can tap link to open app and start follow-ups

---

## Color Scheme

**Brand Colors:**
- **Primary (Teal):** #0a7ea4 - Main actions, buttons, highlights
- **Success (Green):** #22C55E - Approved, completed, qualified
- **Warning (Amber):** #F59E0B - Pending, thinking, in progress
- **Error (Red):** #EF4444 - Rejected, unqualified, lost deals
- **Background:** #ffffff (light) / #151718 (dark)
- **Surface:** #f5f5f5 (light) / #1e2022 (dark)
- **Text:** #11181C (light) / #ECEDEE (dark)

**Status Colors:**
- New Lead: Gray
- Qualified: Green
- In Progress: Blue
- Sales Opportunity: Teal
- Closed Won: Green
- Closed Lost: Red
- Inactive: Gray

---

## Interaction Design Principles

1. **Mobile-First:** All screens optimized for portrait orientation (9:16)
2. **One-Handed Usage:** Critical actions within thumb reach
3. **Minimal Scrolling:** Key information visible above the fold
4. **Clear Call-to-Action:** Primary action buttons prominent and labeled
5. **Feedback:** Loading states, success/error messages, haptic feedback
6. **Accessibility:** High contrast, readable fonts, touch targets ≥ 44pt
7. **Consistency:** Unified navigation, consistent button styles, predictable patterns

---

## Technical Notes

- **Authentication:** Role-based access control (RBAC)
- **Real-time Updates:** Follow-ups, customer assignments, notifications
- **Offline Support:** Cache customer data, sync when online
- **Push Notifications:** WhatsApp reminders, assignment notifications
- **Data Sync:** Cloud sync for cross-device access (Web, Android, iOS)
- **Audit Trail:** All actions logged for compliance and reporting
