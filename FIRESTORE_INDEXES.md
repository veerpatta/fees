# Firestore Indexes Required

This document lists the composite indexes required for the fee management system to function properly.

## Required Composite Indexes

### 1. Payments Collection - Recent Payments Query

**Collection ID:** `payments`

**Fields indexed:**
- `academicYear` (Ascending)
- `paymentDate` (Descending)

**Query scopes:** Collection

**Purpose:** Used to fetch recent payments for the dashboard view, sorted by payment date in descending order.

**Error if missing:** The "Recent Payments" section on the dashboard may fail to load or show an error message about missing indexes.

---

### 2. Payments Collection - Today's Collection Query (Optional)

**Collection ID:** `payments`

**Fields indexed:**
- `academicYear` (Ascending)
- `paymentDate` (Ascending)

**Query scopes:** Collection

**Purpose:** Used to calculate today's collection amount on the dashboard.

**Error if missing:** The "Today's Collection" stat will show ₹0 and a console warning will be logged. The dashboard will still load, but this specific metric won't be accurate.

---

## How to Create These Indexes

### Option 1: Through Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `veer-patta-fees-system`
3. Navigate to **Firestore Database** > **Indexes**
4. Click **Create Index**
5. Configure the index with the fields listed above
6. Click **Create**

### Option 2: Through Error Links

When the application tries to use a query that requires an index:
1. The Firebase SDK will throw an error with a direct link to create the index
2. Check the browser console for these links
3. Click the link to automatically create the index with the correct configuration
4. Wait for the index to build (usually takes a few minutes)

### Option 3: Using Firebase CLI

Create a `firestore.indexes.json` file with the following content:

```json
{
  "indexes": [
    {
      "collectionGroup": "payments",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "academicYear",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "paymentDate",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "payments",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "academicYear",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "paymentDate",
          "order": "ASCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Then deploy using:
```bash
firebase deploy --only firestore:indexes
```

---

## Index Status

You can check the status of your indexes in the Firebase Console:
- **Building:** The index is being created (can take several minutes)
- **Enabled:** The index is ready to use
- **Error:** There was a problem creating the index

---

## Single-Field Indexes

The following single-field indexes are automatically created by Firestore:
- `students.academicYear`
- `payments.academicYear`
- `payments.paymentDate`

No manual configuration is needed for these.

---

## Troubleshooting

### Dashboard shows "Loading..." indefinitely

1. Check the browser console for errors
2. Look for errors mentioning "index" or "failed-precondition"
3. If you see an index error, follow the link provided in the error message
4. Create the required index
5. Wait for the index to finish building
6. Refresh the dashboard page

### "Index Required" message in dashboard

1. The application detected a missing composite index
2. Follow the instructions above to create the index
3. The specific fields needed are shown in the error message
4. After creating the index, refresh the page

---

## Notes

- Indexes can take several minutes to several hours to build, depending on the amount of data
- If you have no data in your collection, indexes will build almost instantly
- It's recommended to create these indexes during initial setup, before adding production data
- Deleting and recreating an index will cause downtime for related queries
