export interface ExtractedItem {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  total: number | null;
}

export interface ExtractedData {
  document_type: string | null;
  supplier: {
    name: string | null;
    ico: string | null;
    dic: string | null;
    address: string | null;
  };
  customer: {
    name: string | null;
    ico: string | null;
    dic: string | null;
    address: string | null;
  };
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  total_amount: number | null;
  currency: string | null;
  vat_base: number | null;
  vat_amount: number | null;
  vat_rate: number | null;
  bank_account: string | null;
  variable_symbol: string | null;
  items: ExtractedItem[];
  notes: string | null;
}

export interface Document {
  id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  file_type: "pdf" | "image";
  status: "processing" | "done" | "error";
  extracted_data: ExtractedData | null;
  created_at: string;
  updated_at: string;
}
