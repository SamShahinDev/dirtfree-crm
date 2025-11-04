-- Create customer_documents table
CREATE TABLE customer_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('contract', 'invoice', 'receipt', 'photo', 'other')),
  description TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id),
  file_size BIGINT DEFAULT 0,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_customer_documents_customer_id ON customer_documents(customer_id);
CREATE INDEX idx_customer_documents_file_type ON customer_documents(file_type);
CREATE INDEX idx_customer_documents_uploaded_at ON customer_documents(uploaded_at);

-- Create RLS policies
ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view documents for customers they have access to
CREATE POLICY "Users can view customer documents" ON customer_documents
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert documents
CREATE POLICY "Users can insert customer documents" ON customer_documents
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update documents they uploaded
CREATE POLICY "Users can update their own uploaded documents" ON customer_documents
  FOR UPDATE
  USING (uploaded_by = auth.uid());

-- Allow authenticated users to delete documents they uploaded
CREATE POLICY "Users can delete their own uploaded documents" ON customer_documents
  FOR DELETE
  USING (uploaded_by = auth.uid());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_customer_documents_updated_at_trigger
  BEFORE UPDATE ON customer_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_documents_updated_at();