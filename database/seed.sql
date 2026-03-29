-- Sample data for testing
-- Insert sample borrowers
INSERT INTO borrowers (id, email, first_name, last_name) VALUES
('b001', 'john.doe@email.com', 'John', 'Doe'),
('b002', 'jane.smith@email.com', 'Jane', 'Smith'),
('b003', 'bob.johnson@email.com', 'Bob', 'Johnson')
ON CONFLICT DO NOTHING;

-- Insert sample loans
INSERT INTO loans (id, borrower_id, loan_amount, loan_date, property_address, property_city, property_state, property_zip, loan_purpose, interest_rate) VALUES
('l001', 'b001', 250000.00, '2024-01-15', '123 Main Street', 'New York', 'NY', '10001', 'Home Purchase', 6.5),
('l002', 'b001', 75000.00, '2024-02-20', '123 Main Street', 'New York', 'NY', '10001', 'Home Improvement', 7.0),
('l003', 'b002', 350000.00, '2024-01-10', '456 Oak Avenue', 'Los Angeles', 'CA', '90001', 'Home Purchase', 6.25),
('l004', 'b003', 180000.00, '2024-03-05', '789 Elm Street', 'Chicago', 'IL', '60601', 'Home Purchase', 6.75)
ON CONFLICT DO NOTHING;
