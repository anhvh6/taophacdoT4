import pandas as pd

try:
    file_path = "d:/Lap trinh/Taophacdo/QLKH_SupaBase_T4 (2).xlsx"
    df = pd.read_excel(file_path, sheet_name="customer_devices")
    
    # Analyze the data
    # Group by customer_id and see if they have multiple device_ids with the same device_name but different ids
    print("Total rows:", len(df))
    print(df.head(10))
    
    # Count devices per customer
    counts = df.groupby('customer_id').size().sort_values(ascending=False)
    print("\nTop 5 customers by device count:")
    print(counts.head(5))
    
    # Show rows for the top customer
    top_customer = counts.index[0]
    print(f"\nDevices for {top_customer}:")
    print(df[df['customer_id'] == top_customer][['device_id', 'device_name', 'is_approved']])
except Exception as e:
    print("Error:", e)
