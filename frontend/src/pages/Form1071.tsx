import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Form1071Request, LoanData, Form1071Data, Form1071SubmissionHistoryItem } from '../types';
import { borrowerAPI, form1071API, loanAPI } from '../services/api';
import { fmtAZ, fmtDate } from '../utils/dateUtils';

const Form1071: React.FC = () => {
  const { guid } = useParams<{ guid: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDashboardView = searchParams.get('source') === 'dashboard';

  const [request, setRequest] = useState<Form1071Request | null>(null);
  const [loan, setLoan] = useState<LoanData | null>(null);
  const [submission, setSubmission] = useState<Form1071Data | null>(null);
  const [submissionHistory, setSubmissionHistory] = useState<Form1071SubmissionHistoryItem[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [borrowerDisplayName, setBorrowerDisplayName] = useState('Borrower');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    applicant_name: '',
    applicant_email: '',
    co_applicant_name: '',
    co_applicant_email: '',
    annual_income: '',
    liquid_assets: '',
    employment_status: '',
    credit_score_range: '',
    military_status: '',
    veteran_status: '',
    demographic_race: '',
    demographic_ethnicity: '',
    demographic_sex: '',
    demographic_age_range: '',
  });

  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const handleClosePage = () => {
    window.close();
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const getValidationErrors = (): { [key: string]: string } => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.applicant_name.trim()) {
      newErrors.applicant_name = 'Applicant name is required';
    }

    if (!formData.applicant_email.trim()) {
      newErrors.applicant_email = 'Applicant email is required';
    } else if (!isValidEmail(formData.applicant_email)) {
      newErrors.applicant_email = 'Please enter a valid email address';
    }

    if (!formData.annual_income.trim()) {
      newErrors.annual_income = 'Annual income is required';
    } else if (isNaN(Number(formData.annual_income.replace(/,/g, '')))) {
      newErrors.annual_income = 'Must be a valid number';
    }

    if (!formData.employment_status) {
      newErrors.employment_status = 'Employment status is required';
    }

    if (!formData.credit_score_range) {
      newErrors.credit_score_range = 'Credit score range is required';
    }

    return newErrors;
  };

  const isFormValid = (): boolean => {
    const newErrors = getValidationErrors();
    setValidationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatCurrency = (value: string): string => {
    const numberValue = value.replace(/,/g, '');
    if (!numberValue || isNaN(Number(numberValue))) return '';
    return Number(numberValue).toLocaleString();
  };

  useEffect(() => {
    loadFormData();
  }, [guid]);

  const loadFormData = async () => {
    try {
      setLoading(true);
      setError('');

      if (!guid) {
        setError('Invalid form link. GUID not provided.');
        return;
      }

      // Get the 1071 request
      const req = await form1071API.getByGuid(guid);
      setRequest(req);

      // Old GUID links remain in history but are marked inactive.
      if (req.status === 'inactive') {
        setError(
          'This 1071 link is inactive. Please use the latest link from your email inbox, or contact your administrator.'
        );
        return;
      }

      // Get the loan details
      const loanData = await loanAPI.getById(req.loan_id);
      setLoan(loanData);

      // Prefill applicant fields from borrower record linked to the loan
      const borrower = await borrowerAPI.getById(req.borrower_id);
      const resolvedBorrowerName = `${borrower.first_name || ''} ${borrower.last_name || ''}`.trim() || 'Borrower';
      setBorrowerDisplayName(resolvedBorrowerName);
      setFormData((prev) => ({
        ...prev,
        applicant_name: resolvedBorrowerName,
        applicant_email: borrower.email || '',
      }));

      // Fetch submission data only when request is marked submitted.
      // For pending requests this endpoint intentionally 404s (not submitted yet).
      if (req.status === 'submitted') {
        const existingSubmission = await form1071API.getSubmission(req.id);
        if (existingSubmission) {
          setSubmission(existingSubmission);
          setFormData({
            applicant_name:
              existingSubmission.applicant_name ||
              resolvedBorrowerName,
            applicant_email: existingSubmission.applicant_email || borrower.email || '',
            co_applicant_name: existingSubmission.co_applicant_name || '',
            co_applicant_email: existingSubmission.co_applicant_email || '',
            annual_income: existingSubmission.annual_income?.toString() || '',
            liquid_assets: existingSubmission.liquid_assets?.toString() || '',
            employment_status: existingSubmission.employment_status || '',
            credit_score_range: existingSubmission.credit_score_range || '',
            military_status: existingSubmission.military_status || '',
            veteran_status: existingSubmission.veteran_status || '',
            demographic_race: existingSubmission.demographic_race || '',
            demographic_ethnicity: existingSubmission.demographic_ethnicity || '',
            demographic_sex: existingSubmission.demographic_sex || '',
            demographic_age_range: existingSubmission.demographic_age_range || '',
          });

          const history = await form1071API.getLoanSubmissionsHistory(req.loan_id);
          setSubmissionHistory(history);
          if (history.length > 0) {
            setSelectedSubmissionId(history[0].id);
          }
        }
      }
    } catch (err) {
      setError('Failed to load form data. The link may be invalid or expired.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    let processedValue = value;

    // Format currency fields
    if ((name === 'annual_income' || name === 'liquid_assets') && value) {
      processedValue = formatCurrency(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));

    // Clear error for this field when user starts typing
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!isFormValid()) {
      return;
    }

    if (!request) {
      setError('Request information not found.');
      return;
    }

    if (submission) {
      setError('This form has already been submitted.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccessMessage('');

      const submissionData: Partial<Form1071Data> = {
        ...formData,
        annual_income: formData.annual_income ? parseInt(formData.annual_income.replace(/,/g, '')) : 0,
        liquid_assets: formData.liquid_assets ? parseInt(formData.liquid_assets.replace(/,/g, '')) : 0,
      };

      const result = await form1071API.submitForm(request.id, submissionData);
      setSubmission(result);
      setRequest((prev) =>
        prev
          ? {
              ...prev,
              status: 'submitted',
              submitted_at: result.updated_at || result.created_at,
            }
          : prev
      );
      setSuccessMessage(
        'Form submitted successfully! You can review your submitted information below.'
      );
    } catch (err) {
      setError('Failed to submit form. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #0a1b3a 0%, #0e2855 55%, #133575 100%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.1rem', fontWeight: 500 }}>
          Loading form…
        </div>
      </div>
    );
  }

  if (!request || !loan) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #0a1b3a 0%, #0e2855 55%, #133575 100%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '40px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}>
          <div className="error">
            {error || 'Form not found. Please check your email link.'}
          </div>
        </div>
      </div>
    );
  }

  const isSubmitted = submission !== null;
  const isAlreadySubmitted = request.status === 'submitted';
  const canSubmit = Object.keys(getValidationErrors()).length === 0;
  const hasMultipleSubmissions = submissionHistory.length > 1;
  const selectedSubmission =
    submissionHistory.find((item) => item.id === selectedSubmissionId) ||
    submissionHistory[0] ||
    null;

  const viewData = selectedSubmission
    ? {
        applicant_name: selectedSubmission.applicant_name || '-',
        applicant_email: selectedSubmission.applicant_email || '-',
        co_applicant_name: selectedSubmission.co_applicant_name || '-',
        co_applicant_email: selectedSubmission.co_applicant_email || '-',
        annual_income:
          selectedSubmission.annual_income !== null && selectedSubmission.annual_income !== undefined
            ? `$${selectedSubmission.annual_income.toLocaleString()}`
            : '-',
        liquid_assets:
          selectedSubmission.liquid_assets !== null && selectedSubmission.liquid_assets !== undefined
            ? `$${selectedSubmission.liquid_assets.toLocaleString()}`
            : '-',
        employment_status: selectedSubmission.employment_status || '-',
        credit_score_range: selectedSubmission.credit_score_range || '-',
        military_status: selectedSubmission.military_status || '-',
        veteran_status: selectedSubmission.veteran_status || '-',
        demographic_race: selectedSubmission.demographic_race || '-',
        demographic_ethnicity: selectedSubmission.demographic_ethnicity || '-',
        demographic_sex: selectedSubmission.demographic_sex || '-',
        demographic_age_range: selectedSubmission.demographic_age_range || '-',
      }
    : {
        applicant_name: formData.applicant_name || '-',
        applicant_email: formData.applicant_email || '-',
        co_applicant_name: formData.co_applicant_name || '-',
        co_applicant_email: formData.co_applicant_email || '-',
        annual_income: formData.annual_income
          ? `$${parseInt(formData.annual_income.replace(/,/g, '')).toLocaleString()}`
          : '-',
        liquid_assets: formData.liquid_assets
          ? `$${parseInt(formData.liquid_assets.replace(/,/g, '')).toLocaleString()}`
          : '-',
        employment_status: formData.employment_status || '-',
        credit_score_range: formData.credit_score_range || '-',
        military_status: formData.military_status || '-',
        veteran_status: formData.veteran_status || '-',
        demographic_race: formData.demographic_race || '-',
        demographic_ethnicity: formData.demographic_ethnicity || '-',
        demographic_sex: formData.demographic_sex || '-',
        demographic_age_range: formData.demographic_age_range || '-',
      };

  return (
    <div
      className="form1071-container"
      style={{
        background: 'linear-gradient(135deg, #0a1b3a 0%, #0e2855 55%, #133575 100%)',
        minHeight: '100vh',
        padding: '40px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Geometric background decorations */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}
             xmlns="http://www.w3.org/2000/svg">
          <polygon points="0,0 35%,0 20%,100% 0,100%" fill="rgba(255,255,255,0.025)" />
          <polygon points="0,0 18%,0 0,38%" fill="rgba(255,255,255,0.035)" />
        </svg>
        <div style={{
          position: 'absolute', right: '-20px', top: '-30px',
          color: 'rgba(255,255,255,0.04)', fontSize: '280px', fontWeight: 900,
          lineHeight: 1, userSelect: 'none',
          fontFamily: '"Arial Black", Arial, sans-serif',
          letterSpacing: '-0.04em', pointerEvents: 'none',
        }}>WA</div>
      </div>

      {/* Shashi System brand header */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          color: 'white', fontSize: '1.4rem', fontWeight: 700,
          letterSpacing: '0.01em', marginBottom: '5px',
        }}>
          Shashi System<sup style={{ fontSize: '0.55em', verticalAlign: 'super' }}>®</sup>
        </div>
        <div style={{
          color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Member FDIC &nbsp;·&nbsp; CFPB Section 1071 Compliance
        </div>
      </div>

      <div
        style={{
          width: 'clamp(320px, 92vw, 1600px)',
          margin: '0 auto',
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '12px',
          padding: '40px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.45)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              color: '#0a1b3a',
              marginBottom: '10px',
              letterSpacing: '-0.02em',
            }}
          >
            {isSubmitted ? `1071 Record for ${borrowerDisplayName}` : 'CFPB 1071 Data Collection'}
          </h1>
          <p
            style={{
              fontSize: '1rem',
              color: '#666',
              marginBottom: '0',
              fontWeight: '400',
            }}
          >
            Please provide the requested information for your loan application
          </p>
        </div>

      {error && (
        <div
          style={{
            backgroundColor: '#ffebee',
            color: '#c62828',
            padding: '15px',
            borderRadius: '6px',
            marginBottom: '20px',
            border: '1px solid #ef5350',
          }}
        >
          {error}
        </div>
      )}
      {successMessage && (
        <div
          style={{
            backgroundColor: '#e8f5e9',
            color: '#2e7d32',
            padding: '15px',
            borderRadius: '6px',
            marginBottom: '20px',
            border: '1px solid #81c784',
          }}
        >
          {successMessage}
        </div>
      )}

      <div style={{ maxWidth: '700px' }}>
        {/* Loan Information Preview */}
        {loan && (
          <div
            style={{
              backgroundColor: '#F0F4F8',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '30px',
              borderLeft: '4px solid #003366',
            }}
          >
            <h3 style={{ color: '#003366', marginTop: '0', marginBottom: '15px' }}>
              Loan Information
            </h3>
            <table
              style={{
                width: '100%',
                fontSize: '0.95rem',
                lineHeight: '1.8',
              }}
            >
              <tbody>
                <tr>
                  <td style={{ fontWeight: '600', color: '#003366', paddingBottom: '8px' }}>
                    Loan Amount:
                  </td>
                  <td style={{ paddingBottom: '8px' }}>
                    ${loan.loan_amount?.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: '600', color: '#003366', paddingBottom: '8px' }}>
                    Loan Date:
                  </td>
                  <td style={{ paddingBottom: '8px' }}>
                    {fmtDate(loan.loan_date)}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: '600', color: '#003366', paddingBottom: '8px' }}>
                    Property Address:
                  </td>
                  <td style={{ paddingBottom: '8px' }}>
                    {loan.property_address}, {loan.property_city}, {loan.property_state}{' '}
                    {loan.property_zip}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: '600', color: '#003366', paddingBottom: '8px' }}>
                    Loan Purpose:
                  </td>
                  <td style={{ paddingBottom: '8px' }}>{loan.loan_purpose}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: '600', color: '#003366' }}>Interest Rate:</td>
                  <td>{loan.interest_rate}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 1071 Form or Read-Only Display */}
        {isAlreadySubmitted ? (
          <div
            style={{
              backgroundColor: '#E8F5E9',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #81c784',
              color: '#2e7d32',
            }}
          >
            <p style={{ margin: '0', fontWeight: '600' }}>
              ✓ This form has already been submitted on{' '}
              {fmtAZ(request.submitted_at, 'MM/DD/YYYY h:mm A')} MST. Thank you for
              providing the information.
            </p>
          </div>
        ) : null}

        {isSubmitted ? (
          // Read-only submission view
          <div
            style={
              hasMultipleSubmissions
                ? {
                    display: 'grid',
                    gridTemplateColumns: '260px 1fr',
                    gap: '18px',
                    alignItems: 'start',
                  }
                : {}
            }
          >
            {hasMultipleSubmissions && (
              <div
                style={{
                  backgroundColor: '#F7F9FC',
                  border: '1px solid #d7e1ee',
                  borderRadius: '8px',
                  padding: '12px',
                  position: 'sticky',
                  top: '12px',
                }}
              >
                <h4 style={{ margin: '0 0 10px', color: '#003366' }}>Submission History</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {submissionHistory.map((item) => {
                    const isActive = selectedSubmissionId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedSubmissionId(item.id)}
                        style={{
                          textAlign: 'left',
                          width: '100%',
                          borderRadius: '6px',
                          border: isActive ? '1px solid #003366' : '1px solid #d0d9e5',
                          backgroundColor: isActive ? '#EAF2FF' : '#fff',
                          color: '#1f2a3d',
                          padding: '9px 10px',
                          cursor: 'pointer',
                          fontWeight: isActive ? 700 : 500,
                          boxShadow: 'none',
                          transform: 'none',
                        }}
                      >
                        {fmtAZ(item.submitted_at || item.created_at, 'MM/DD/YYYY h:mm A')} MST
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ backgroundColor: '#FAFAFA', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ color: '#003366', marginTop: '0', marginBottom: '20px' }}>Submitted Information (Read-Only)</h3>
            
            {/* Applicant Information */}
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ color: '#003366', marginBottom: '12px', borderBottom: '2px solid #003366', paddingBottom: '8px' }}>
                Applicant Information
              </h4>
              <div className="readonly-grid">
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Applicant Name</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.applicant_name}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Applicant Email</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.applicant_email}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Co-Applicant Name</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.co_applicant_name}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Co-Applicant Email</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.co_applicant_email}</div>
                </div>
              </div>
            </div>

            {/* Financial Information */}
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ color: '#003366', marginBottom: '12px', borderBottom: '2px solid #003366', paddingBottom: '8px' }}>
                Financial Information
              </h4>
              <div className="readonly-grid">
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Annual Income</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.annual_income}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Liquid Assets</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.liquid_assets}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Employment Status</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.employment_status}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Credit Score Range</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.credit_score_range}</div>
                </div>
              </div>
            </div>

            {/* Military & Veteran Information */}
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ color: '#003366', marginBottom: '12px', borderBottom: '2px solid #003366', paddingBottom: '8px' }}>
                Military Status
              </h4>
              <div className="readonly-grid">
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Military Status</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.military_status}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Veteran Status</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.veteran_status}</div>
                </div>
              </div>
            </div>

            {/* Demographics Information */}
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ color: '#003366', marginBottom: '12px', borderBottom: '2px solid #003366', paddingBottom: '8px' }}>
                Demographics (Optional)
              </h4>
              <div className="readonly-grid">
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Race/Ethnicity</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.demographic_race}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Ethnicity Detail</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.demographic_ethnicity}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Sex</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.demographic_sex}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Age Range</div>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{viewData.demographic_age_range}</div>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '30px' }}>
              {isDashboardView ? (
                <button
                  onClick={() => navigate('/')}
                  style={{
                    backgroundColor: '#003366',
                    color: 'white',
                    padding: '12px 30px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: '6px',
                  }}
                >
                  Return to Dashboard
                </button>
              ) : (
                <button
                  onClick={handleClosePage}
                  style={{
                    backgroundColor: '#003366',
                    color: 'white',
                    padding: '12px 30px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: '6px',
                  }}
                >
                  Close
                </button>
              )}
            </div>
            </div>
          </div>
        ) : (
          // Form submission view
          <form
            onSubmit={handleSubmit}
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
            }}
          >
            {/* Applicant Information */}
            <h3 style={{ marginTop: '0', marginBottom: '20px', color: '#003366' }}>
              Applicant Information
            </h3>

            <div className="form-group">
              <label htmlFor="applicant_name">
                Applicant Name <span style={{ color: '#DC143C' }}>*</span>
              </label>
              <input
                type="text"
                id="applicant_name"
                name="applicant_name"
                value={formData.applicant_name}
                onChange={handleInputChange}
                disabled={true}
                readOnly={true}
                style={{
                  backgroundColor: '#F5F5F5',
                  cursor: 'not-allowed',
                  opacity: '0.8',
                }}
              />
              {validationErrors.applicant_name && (
                <div style={{ color: '#DC143C', fontSize: '0.85rem', marginTop: '4px' }}>
                  {validationErrors.applicant_name}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="applicant_email">
                Applicant Email <span style={{ color: '#DC143C' }}>*</span>
              </label>
              <input
                type="email"
                id="applicant_email"
                name="applicant_email"
                value={formData.applicant_email}
                onChange={handleInputChange}
                disabled={true}
                readOnly={true}
                style={{
                  backgroundColor: '#F5F5F5',
                  cursor: 'not-allowed',
                  opacity: '0.8',
                }}
              />
              {validationErrors.applicant_email && (
                <div style={{ color: '#DC143C', fontSize: '0.85rem', marginTop: '4px' }}>
                  {validationErrors.applicant_email}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="co_applicant_name">Co-Applicant Name</label>
              <input
                type="text"
                id="co_applicant_name"
                name="co_applicant_name"
                value={formData.co_applicant_name}
                onChange={handleInputChange}
                disabled={isSubmitted}
              />
            </div>

            <div className="form-group">
              <label htmlFor="co_applicant_email">Co-Applicant Email</label>
              <input
                type="email"
                id="co_applicant_email"
                name="co_applicant_email"
                value={formData.co_applicant_email}
                onChange={handleInputChange}
                disabled={isSubmitted}
              />
            </div>

            {/* Financial Information */}
            <h3 style={{ marginTop: '30px', marginBottom: '20px', color: '#003366' }}>
              Financial Information
            </h3>

            <div className="form-group">
              <label htmlFor="annual_income">
                Annual Income ($) <span style={{ color: '#DC143C' }}>*</span>
              </label>
              <input
                type="text"
                id="annual_income"
                name="annual_income"
                value={formData.annual_income}
                onChange={handleInputChange}
                placeholder="0"
                disabled={isSubmitted}
                style={{
                  backgroundColor: isSubmitted ? '#F5F5F5' : 'white',
                }}
              />
              {validationErrors.annual_income && (
                <div style={{ color: '#DC143C', fontSize: '0.85rem', marginTop: '4px' }}>
                  {validationErrors.annual_income}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="liquid_assets">Liquid Assets ($)</label>
              <input
                type="text"
                id="liquid_assets"
                name="liquid_assets"
                value={formData.liquid_assets}
                onChange={handleInputChange}
                placeholder="0"
                disabled={isSubmitted}
                style={{
                  backgroundColor: isSubmitted ? '#F5F5F5' : 'white',
                }}
              />
              {validationErrors.liquid_assets && (
                <div style={{ color: '#DC143C', fontSize: '0.85rem', marginTop: '4px' }}>
                  {validationErrors.liquid_assets}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="employment_status">
                Employment Status <span style={{ color: '#DC143C' }}>*</span>
              </label>
              <select
                id="employment_status"
                name="employment_status"
                value={formData.employment_status}
                onChange={handleInputChange}
                disabled={isSubmitted}
                style={{
                  backgroundColor: isSubmitted ? '#F5F5F5' : 'white',
                }}
              >
                <option value="">Select...</option>
                <option value="employed">Employed</option>
                <option value="self-employed">Self-Employed</option>
                <option value="retired">Retired</option>
                <option value="unemployed">Unemployed</option>
                <option value="student">Student</option>
              </select>
              {validationErrors.employment_status && (
                <div style={{ color: '#DC143C', fontSize: '0.85rem', marginTop: '4px' }}>
                  {validationErrors.employment_status}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="credit_score_range">
                Credit Score Range <span style={{ color: '#DC143C' }}>*</span>
              </label>
              <select
                id="credit_score_range"
                name="credit_score_range"
                value={formData.credit_score_range}
                onChange={handleInputChange}
                disabled={isSubmitted}
                style={{
                  backgroundColor: isSubmitted ? '#F5F5F5' : 'white',
                }}
              >
                <option value="">Select...</option>
                <option value="no-history">No Credit History</option>
                <option value="under-580">Under 580</option>
                <option value="580-619">580-619</option>
                <option value="620-679">620-679</option>
                <option value="680-739">680-739</option>
                <option value="740-799">740-799</option>
                <option value="800-plus">800+</option>
              </select>
              {validationErrors.credit_score_range && (
                <div style={{ color: '#DC143C', fontSize: '0.85rem', marginTop: '4px' }}>
                  {validationErrors.credit_score_range}
                </div>
              )}
            </div>

            {/* Demographic Information */}
            <h3 style={{ marginTop: '30px', marginBottom: '20px', color: '#003366' }}>
              Demographics (Optional)
            </h3>

            <div className="form-group">
              <label htmlFor="military_status">Military Status</label>
              <select
                id="military_status"
                name="military_status"
                value={formData.military_status}
                onChange={handleInputChange}
                disabled={isSubmitted}
              >
                <option value="">Select...</option>
                <option value="active-duty">Active Duty</option>
                <option value="reserve">Reserve</option>
                <option value="national-guard">National Guard</option>
                <option value="not-applicable">Not Applicable</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="veteran_status">Veteran Status</label>
              <select
                id="veteran_status"
                name="veteran_status"
                value={formData.veteran_status}
                onChange={handleInputChange}
                disabled={isSubmitted}
              >
                <option value="">Select...</option>
                <option value="veteran">Veteran</option>
                <option value="not-veteran">Not a Veteran</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="demographic_race">Race/Ethnicity</label>
              <select
                id="demographic_race"
                name="demographic_race"
                value={formData.demographic_race}
                onChange={handleInputChange}
                disabled={isSubmitted}
              >
                <option value="">Select...</option>
                <option value="american-indian">American Indian/Alaska Native</option>
                <option value="asian">Asian</option>
                <option value="black">Black/African American</option>
                <option value="hispanic">Hispanic/Latino</option>
                <option value="native-hawaiian">
                  Native Hawaiian/Other Pacific Islander
                </option>
                <option value="white">White</option>
                <option value="two-or-more">Two or More Races</option>
                <option value="not-specified">Not Specified</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="demographic_ethnicity">Ethnicity Detail</label>
              <input
                type="text"
                id="demographic_ethnicity"
                name="demographic_ethnicity"
                value={formData.demographic_ethnicity}
                onChange={handleInputChange}
                placeholder="If applicable"
                disabled={isSubmitted}
              />
            </div>

            <div className="form-group">
              <label htmlFor="demographic_sex">Sex</label>
              <select
                id="demographic_sex"
                name="demographic_sex"
                value={formData.demographic_sex}
                onChange={handleInputChange}
                disabled={isSubmitted}
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="not-specified">Not Specified</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="demographic_age_range">Age Range</label>
              <select
                id="demographic_age_range"
                name="demographic_age_range"
                value={formData.demographic_age_range}
                onChange={handleInputChange}
                disabled={isSubmitted}
              >
                <option value="">Select...</option>
                <option value="under-25">Under 25</option>
                <option value="25-34">25-34</option>
                <option value="35-44">35-44</option>
                <option value="45-54">45-54</option>
                <option value="55-64">55-64</option>
                <option value="65-plus">65+</option>
                <option value="not-specified">Not Specified</option>
              </select>
            </div>

            {/* Buttons */}
            <div style={{ marginTop: '40px', textAlign: 'center', display: 'flex', gap: '15px', justifyContent: 'center' }}>
              {isSubmitted ? (
                <button
                  className="btn-success"
                  type="button"
                  style={{
                    backgroundColor: '#4CAF50',
                    padding: '12px 30px',
                    fontSize: '1rem',
                    fontWeight: '600',
                  }}
                >
                  ✓ Form Submitted
                </button>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={submitting || !canSubmit}
                    style={{
                      backgroundColor: !canSubmit ? '#CCCCCC' : '#003366',
                      color: 'white',
                      padding: '12px 30px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: !canSubmit ? 'not-allowed' : 'pointer',
                      opacity: !canSubmit ? '0.6' : '1',
                    }}
                  >
                    {submitting ? 'Submitting...' : 'Submit Form'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate('/')}
                    style={{
                      padding: '12px 30px',
                      fontSize: '1rem',
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
    </div>
  );
};

export default Form1071;
