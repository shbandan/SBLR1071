import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Borrower, DashboardBorrowerRow, DashboardResponseTrend, DashboardSummary, LoanWithRequest, LoanData } from '../types';
import { borrowerAPI, dashboardAPI, loanAPI, form1071API } from '../services/api';
import { fmtAZ, fmtDate, nowAZ, dayjs } from '../utils/dateUtils';
import {
  FiEdit,
  FiPlus,
  FiTrash2,
  FiChevronRight,
  FiChevronDown,
  FiBarChart2,
  FiX,
  FiRefreshCw,
  FiDownload,
  FiSend,
  FiClock,
  FiEye,
} from 'react-icons/fi';
import { downloadExcel } from '../services/excelExport';
import ApplicationHeader from '../components/ApplicationHeader';

interface Modal {
  type: 'borrower' | 'loan' | 'addLoan' | 'addBorrower' | null;
  data?: Borrower | LoanData | null;
  borrowerId?: string;
}

const LOAN_TABLE_COLUMN_HEADERS = [
  'Loan Amount',
  'Loan Date',
  'Property Address',
  'Line of Business',
  'Product Type',
  'Purpose',
  'Interest Rate',
  'Collection Status',
  'Actions',
] as const;

const LOAN_TABLE_DEFAULT_WIDTHS = [120, 110, 180, 150, 140, 130, 120, 260, 170];
const LOAN_TABLE_MIN_WIDTHS = [100, 90, 140, 120, 110, 100, 90, 220, 150];
const LOAN_TABLE_WIDTHS_STORAGE_KEY = 'dashboard-loan-table-widths';

type GraphTooltipMoveHandler = (event: React.MouseEvent<any>, text: string) => void;
type GraphTooltipLeaveHandler = () => void;

const renderDonutMeter = (
  testId: string,
  label: string,
  detail: string,
  metric: { completed: number; total: number },
  accent: string,
  loading = false,
  onTooltipMove?: GraphTooltipMoveHandler,
  onTooltipLeave?: GraphTooltipLeaveHandler
) => {
  if (loading) {
    return (
      <div
        className="dashboard-meter-card dashboard-meter-card-loading"
        aria-hidden="true"
        data-testid={`${testId}-loading`}
      >
        <div className="dashboard-meter-visual dashboard-skeleton dashboard-skeleton-circle" />
        <div className="dashboard-meter-copy dashboard-meter-copy-loading">
          <div className="dashboard-skeleton dashboard-skeleton-title" />
          <div className="dashboard-skeleton dashboard-skeleton-line" />
          <div className="dashboard-skeleton dashboard-skeleton-line dashboard-skeleton-line-short" />
        </div>
      </div>
    );
  }

  const total = Math.max(metric.total, 0);
  const completed = Math.min(Math.max(metric.completed, 0), total || metric.completed);
  const ratio = total > 0 ? completed / total : 0;
  const percentage = total > 0 ? Math.round(ratio * 100) : 0;
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);
  const donutHoverText = `${label}: ${completed}/${total} (${percentage}%)`;

  return (
    <div
      className="dashboard-meter-card"
      aria-label={`${label}: ${completed} of ${total}`}
      data-testid={testId}
      onMouseEnter={(event) => onTooltipMove?.(event, donutHoverText)}
      onMouseMove={(event) => onTooltipMove?.(event, donutHoverText)}
      onMouseLeave={() => onTooltipLeave?.()}
    >
      <div className="dashboard-meter-visual">
        <svg className="dashboard-meter-chart" viewBox="0 0 84 84" role="img" aria-hidden="true">
          <circle className="dashboard-meter-track" cx="42" cy="42" r={radius} />
          <circle
            className="dashboard-meter-progress"
            cx="42"
            cy="42"
            r={radius}
            style={{ stroke: accent, strokeDasharray: circumference, strokeDashoffset: dashOffset }}
          />
        </svg>
        <div className="dashboard-meter-center" data-testid={`${testId}-center`}>
          <strong>{percentage}%</strong>
          <span>{completed}/{total}</span>
        </div>
      </div>
      <div className="dashboard-meter-copy">
        <h3 data-testid={`${testId}-label`}>{label}</h3>
        <p data-testid={`${testId}-detail`}>{detail}</p>
      </div>
    </div>
  );
};

const renderQuarterlyTrend = (
  trend: DashboardResponseTrend,
  loading = false,
  onTooltipMove?: GraphTooltipMoveHandler,
  onTooltipLeave?: GraphTooltipLeaveHandler
) => {
  if (loading) {
    return (
      <div
        className="dashboard-trend-card dashboard-trend-card-loading"
        aria-hidden="true"
        data-testid="dashboard-trend-loading"
      >
        <div className="dashboard-trend-header">
          <div className="dashboard-trend-header-copy">
            <div className="dashboard-skeleton dashboard-skeleton-title" />
            <div className="dashboard-skeleton dashboard-skeleton-line" />
          </div>
          <div className="dashboard-trend-stat dashboard-trend-stat-loading">
            <div className="dashboard-skeleton dashboard-skeleton-stat" />
            <div className="dashboard-skeleton dashboard-skeleton-line dashboard-skeleton-line-short" />
          </div>
        </div>
        <div className="dashboard-skeleton dashboard-skeleton-chart" />
      </div>
    );
  }

  const chartWidth = 320;
  const chartHeight = 128;
  const paddingLeft = 18;
  const paddingRight = 18;
  const paddingTop = 14;
  const paddingBottom = 30;
  const points = trend.points;
  const responseValues = points.map((point) => point.average_response_days ?? 0);
  const maxValue = Math.max(...responseValues, 1);
  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const xStep = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const plottedPoints = points.map((point, index) => {
    const value = point.average_response_days ?? 0;
    const x = paddingLeft + index * xStep;
    const y = paddingTop + innerHeight - (value / maxValue) * innerHeight;
    return { ...point, value, x, y };
  });

  const linePath = plottedPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = `${linePath} L ${paddingLeft + innerWidth} ${paddingTop + innerHeight} L ${paddingLeft} ${paddingTop + innerHeight} Z`;
  const latestPoint = [...points].reverse().find((point) => point.average_response_days !== null);

  return (
    <div className="dashboard-trend-card" data-testid="dashboard-trend-card">
      <div className="dashboard-trend-header">
        <div>
          <h3 data-testid="dashboard-trend-title">24-Month Borrower Response Trend</h3>
          <p data-testid="dashboard-trend-description">Avg days from request to 1071 submission by quarter</p>
        </div>
        <div className="dashboard-trend-stat" data-testid="dashboard-trend-latest">
          <strong>
            {latestPoint?.average_response_days != null ? `${latestPoint.average_response_days}d` : '--'}
          </strong>
          <span>latest</span>
        </div>
      </div>
      <svg
        className="dashboard-trend-chart"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label="Quarterly borrower response speed trend"
        data-testid="dashboard-trend-chart"
      >
        <path className="dashboard-trend-area" d={areaPath} />
        <path className="dashboard-trend-line" d={linePath} />
        {plottedPoints.map((point, index) => {
          const pointTooltipText = `${point.quarter_label}: ${point.average_response_days ?? '--'} days avg, ${point.submitted_count} submissions`;

          return (
            <g
            key={point.quarter_label}
            data-testid={`dashboard-trend-point-${index}`}
            data-quarter-label={point.quarter_label}
            data-average-response-days={point.average_response_days ?? ''}
            data-submitted-count={point.submitted_count}
            onMouseEnter={(event) => onTooltipMove?.(event, pointTooltipText)}
            onMouseMove={(event) => onTooltipMove?.(event, pointTooltipText)}
            onMouseLeave={() => onTooltipLeave?.()}
          >
            <circle className="dashboard-trend-point" cx={point.x} cy={point.y} r="3.5" />
            <text
              className="dashboard-trend-x-label"
              x={point.x}
              y={chartHeight - 8}
              textAnchor="middle"
              data-testid={`dashboard-trend-label-${index}`}
            >
              {point.quarter_label}
            </text>
          </g>
          );
        })}
      </svg>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [borrowers, setBorrowers] = useState<DashboardBorrowerRow[]>([]);
  const [expandedBorrowerIds, setExpandedBorrowerIds] = useState<string[]>([]);
  const [loansMap, setLoansMap] = useState<Record<string, LoanWithRequest[]>>({});
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loanLoadingMap, setLoanLoadingMap] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [processingLoanId, setProcessingLoanId] = useState<string | null>(null);
  const [resendingRequestId, setResendingRequestId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [modal, setModal] = useState<Modal>({ type: null });
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary>({
    borrowers: { completed: 0, total: 0 },
    loans: { completed: 0, total: 0 },
  });
  const [responseTrend, setResponseTrend] = useState<DashboardResponseTrend>({ points: [] });
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [responseTrendLoading, setResponseTrendLoading] = useState(true);
  const [graphsRefreshing, setGraphsRefreshing] = useState(false);
  const [graphTooltip, setGraphTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [loanColumnWidths, setLoanColumnWidths] = useState<number[]>(() => {
    if (typeof window === 'undefined') {
      return LOAN_TABLE_DEFAULT_WIDTHS;
    }

    try {
      const saved = window.localStorage.getItem(LOAN_TABLE_WIDTHS_STORAGE_KEY);
      if (!saved) {
        return LOAN_TABLE_DEFAULT_WIDTHS;
      }

      const parsed = JSON.parse(saved);
      if (
        Array.isArray(parsed) &&
        parsed.length === LOAN_TABLE_DEFAULT_WIDTHS.length &&
        parsed.every((value) => typeof value === 'number' && Number.isFinite(value))
      ) {
        return parsed.map((value, index) => Math.max(LOAN_TABLE_MIN_WIDTHS[index], value));
      }
    } catch (error) {
      console.error('Failed to load saved loan table widths', error);
    }

    return LOAN_TABLE_DEFAULT_WIDTHS;
  });
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loanResizeRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  const loanTableWidth = useMemo(
    () => loanColumnWidths.reduce((total, width) => total + width, 0),
    [loanColumnWidths]
  );

  useEffect(() => {
    window.localStorage.setItem(
      LOAN_TABLE_WIDTHS_STORAGE_KEY,
      JSON.stringify(loanColumnWidths)
    );
  }, [loanColumnWidths]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const resizeState = loanResizeRef.current;
      if (!resizeState) {
        return;
      }

      const nextWidth = Math.max(
        LOAN_TABLE_MIN_WIDTHS[resizeState.index],
        resizeState.startWidth + (event.clientX - resizeState.startX)
      );

      setLoanColumnWidths((prev) =>
        prev.map((width, index) => (index === resizeState.index ? nextWidth : width))
      );
    };

    const handleMouseUp = () => {
      loanResizeRef.current = null;
      document.body.classList.remove('column-resize-active');
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('column-resize-active');
    };
  }, []);

  const startLoanColumnResize = useCallback(
    (index: number, event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      loanResizeRef.current = {
        index,
        startX: event.clientX,
        startWidth: loanColumnWidths[index],
      };
      document.body.classList.add('column-resize-active');
    },
    [loanColumnWidths]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalized = searchInput.trim();
      setDebouncedSearch(normalized.length >= 3 ? normalized : '');
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadBorrowersPage = useCallback(
    async (reset: boolean) => {
      if (reset) {
        setLoadingInitial(true);
      } else {
        if (!hasMore || loadingMore) {
          return;
        }
        setLoadingMore(true);
      }

      try {
        setError('');
        let page;
        let requestError: unknown = null;

        // Retry a few times to tolerate backend warm-up timing during local startup.
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            page = await dashboardAPI.getBorrowers({
              limit: 20,
              cursor: reset ? undefined : nextCursor,
              q: debouncedSearch || undefined,
            });
            requestError = null;
            break;
          } catch (err) {
            requestError = err;
            if (attempt < 3) {
              await new Promise((resolve) => window.setTimeout(resolve, attempt * 300));
            }
          }
        }

        if (!page) {
          throw requestError || new Error('Failed to load borrowers');
        }

        setBorrowers((prev) => (reset ? page.items : [...prev, ...page.items]));
        setHasMore(page.has_more);
        setNextCursor(page.next_cursor);
        if (reset) {
          const borrowerIds = new Set(page.items.map((item) => item.id));
          setExpandedBorrowerIds((prev) => prev.filter((id) => borrowerIds.has(id)));
          setLoansMap((prev) =>
            Object.fromEntries(Object.entries(prev).filter(([id]) => borrowerIds.has(id)))
          );
          setLoanLoadingMap((prev) =>
            Object.fromEntries(Object.entries(prev).filter(([id]) => borrowerIds.has(id)))
          );
        }
      } catch (err) {
        setError('Failed to load borrowers. Please make sure backend is running and try again.');
        console.error(err);
      } finally {
        setLoadingInitial(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, hasMore, loadingMore, nextCursor]
  );

  useEffect(() => {
    setHasMore(true);
    setNextCursor(undefined);
    loadBorrowersPage(true);
  }, [debouncedSearch]);

  const fetchDashboardWithRetry = useCallback(
    async <T,>(requestFn: () => Promise<T>, fallbackValue: T): Promise<T> => {
      let requestError: unknown = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          return await requestFn();
        } catch (err) {
          requestError = err;
          if (attempt < 3) {
            await new Promise((resolve) => window.setTimeout(resolve, attempt * 300));
          }
        }
      }

      console.error('Dashboard graph request failed after retries', requestError);
      return fallbackValue;
    },
    []
  );

  const loadDashboardSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await fetchDashboardWithRetry(
        () => dashboardAPI.getSummary(),
        { borrowers: { completed: 0, total: 0 }, loans: { completed: 0, total: 0 } }
      );
      setSummary(data);
    } catch (err) {
      console.error('Failed to load dashboard summary', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [fetchDashboardWithRetry]);

  useEffect(() => {
    loadDashboardSummary();
  }, [loadDashboardSummary]);

  const loadDashboardResponseTrend = useCallback(async () => {
    setResponseTrendLoading(true);
    try {
      const data = await fetchDashboardWithRetry(
        () => dashboardAPI.getResponseTrend(),
        { points: [] }
      );
      setResponseTrend(data);
    } catch (err) {
      console.error('Failed to load dashboard response trend', err);
    } finally {
      setResponseTrendLoading(false);
    }
  }, [fetchDashboardWithRetry]);

  const handleGraphTooltipMove = useCallback<GraphTooltipMoveHandler>((event, text) => {
    setGraphTooltip({
      text,
      x: event.clientX + 14,
      y: event.clientY + 14,
    });
  }, []);

  const handleGraphTooltipLeave = useCallback(() => {
    setGraphTooltip(null);
  }, []);

  useEffect(() => {
    loadDashboardResponseTrend();
  }, [loadDashboardResponseTrend]);

  const handleRefreshGraphs = useCallback(async () => {
    setGraphsRefreshing(true);
    setGraphTooltip(null);
    try {
      await Promise.all([loadDashboardSummary(), loadDashboardResponseTrend()]);
    } finally {
      setGraphsRefreshing(false);
    }
  }, [loadDashboardSummary, loadDashboardResponseTrend]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingInitial && !loadingMore) {
          loadBorrowersPage(false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingInitial, loadingMore, loadBorrowersPage]);

  const fetchLoans = async (borrowerId: string) => {
    try {
      if (loansMap[borrowerId] || loanLoadingMap[borrowerId]) {
        return;
      }

      setLoanLoadingMap((prev) => ({ ...prev, [borrowerId]: true }));
      const data = await loanAPI.getByBorrowerId(borrowerId);
      setLoansMap((prev) => ({
        ...prev,
        [borrowerId]: data,
      }));
    } catch (err) {
      setError('Failed to load loans. Please try again.');
      console.error(err);
    } finally {
      setLoanLoadingMap((prev) => ({ ...prev, [borrowerId]: false }));
    }
  };

  const handleExpandBorrower = async (borrowerId: string) => {
    if (expandedBorrowerIds.includes(borrowerId)) {
      setExpandedBorrowerIds((prev) => prev.filter((id) => id !== borrowerId));
    } else {
      setExpandedBorrowerIds((prev) => [...prev, borrowerId]);
      await fetchLoans(borrowerId);
    }
  };

  const handleCollect1071 = async (loan: LoanWithRequest, borrowerEmail: string) => {
    try {
      setProcessingLoanId(loan.id);
      setError('');
      setSuccessMessage('');

      const request = await form1071API.submitRequest(loan.id, borrowerEmail);

      setSuccessMessage(
        `Email sent to ${borrowerEmail}. Request ID: ${request.guid}`
      );

      // Refresh loans
      const updatedLoans = await loanAPI.getByBorrowerId(loan.borrower_id);
      setLoansMap((prev) => ({
        ...prev,
        [loan.borrower_id]: updatedLoans,
      }));
      // Refresh borrower summary counters
      await loadBorrowersPage(true);
      await loadDashboardSummary();
      await loadDashboardResponseTrend();

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError('Failed to send collection request. Please try again.');
      console.error(err);
    } finally {
      setProcessingLoanId(null);
    }
  };

  const handleResend1071 = async (loan: LoanWithRequest, borrowerEmail: string) => {
    try {
      setResendingRequestId(loan.request?.id || null);
      setError('');
      setSuccessMessage('');

      if (!loan.request?.id) {
        setError('Request not found');
        return;
      }

      await form1071API.resendRequest(loan.request.id);

      setSuccessMessage(
        `Email resent to ${borrowerEmail}. Timestamp updated.`
      );

      // Refresh loans
      const updatedLoans = await loanAPI.getByBorrowerId(loan.borrower_id);
      setLoansMap((prev) => ({
        ...prev,
        [loan.borrower_id]: updatedLoans,
      }));
      await loadBorrowersPage(true);
      await loadDashboardSummary();
      await loadDashboardResponseTrend();

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError('Failed to resend collection request. Please try again.');
      console.error(err);
    } finally {
      setResendingRequestId(null);
    }
  };

  const getCollectionStatus = (loan: LoanWithRequest) => {
    if (loan.request?.status === 'submitted' && loan.request.submitted_at) {
      return {
        status: 'Collected',
        timestamp: fmtAZ(loan.request.submitted_at, 'MM/DD/YYYY h:mm A') + ' MST',
        type: 'collected',
      };
    }
    if (loan.request?.status === 'pending') {
      return {
        status: 'Pending',
        timestamp: fmtAZ(loan.request.request_sent_at, 'MM/DD/YYYY h:mm A') + ' MST',
        type: 'pending',
      };
    }
    return {
      status: 'Not Collected',
      timestamp: '',
      type: 'not-collected',
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getRequestCounts = (borrower: DashboardBorrowerRow) => ({
    pending: borrower.pending_requests,
    collected: borrower.collected_requests,
  });

  const handleEditBorrower = (borrower: Borrower) => {
    setModal({ type: 'borrower', data: borrower });
  };

  const handleEditLoan = (loan: LoanData) => {
    setModal({ type: 'loan', data: loan });
  };

  const handleAddLoan = (borrowerId: string) => {
    setModal({ type: 'addLoan', borrowerId });
  };

  const handleAddBorrower = () => {
    setModal({ type: 'addBorrower' });
  };

  const handleDownloadExcel = async () => {
    try {
      setError('');
      setSuccessMessage('');

      const missingLoanBorrowers = borrowers.filter((borrower) => !loansMap[borrower.id]);
      const fetchedLoanEntries = await Promise.all(
        missingLoanBorrowers.map(async (borrower) => {
          const data = await loanAPI.getByBorrowerId(borrower.id);
          return [borrower.id, data] as const;
        })
      );

      const fetchedLoansMap = Object.fromEntries(fetchedLoanEntries);
      const exportLoansMap = {
        ...loansMap,
        ...fetchedLoansMap,
      };

      if (fetchedLoanEntries.length > 0) {
        setLoansMap((prev) => ({
          ...prev,
          ...fetchedLoansMap,
        }));
      }

      const filename = `CFPB1071_Data_${nowAZ('YYYY-MM-DD_HHmmss')}.xlsx`;
      downloadExcel(borrowers, exportLoansMap, filename);
      setSuccessMessage('Data exported successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to export data');
      console.error(err);
    }
  };

  const handleDeleteBorrower = async (borrowerId: string) => {
    if (window.confirm('Are you sure you want to delete this borrower and all associated loans?')) {
      try {
        setSubmitting(true);
        await borrowerAPI.delete(borrowerId);
        setSuccessMessage('Borrower deleted successfully');
        await loadBorrowersPage(true);
        await loadDashboardSummary();
        await loadDashboardResponseTrend();
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setError('Failed to delete borrower');
        console.error(err);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleDeleteLoan = async (loanId: string, borrowerId: string) => {
    if (window.confirm('Are you sure you want to delete this loan?')) {
      try {
        setSubmitting(true);
        await loanAPI.delete(loanId);
        const updatedLoans = await loanAPI.getByBorrowerId(borrowerId);
        setLoansMap((prev) => ({
          ...prev,
          [borrowerId]: updatedLoans,
        }));
        await loadBorrowersPage(true);
        await loadDashboardSummary();
        await loadDashboardResponseTrend();
        setSuccessMessage('Loan deleted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setError('Failed to delete loan');
        console.error(err);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleSaveBorrower = async (formData: any) => {
    try {
      setSubmitting(true);
      setError('');

      if ((modal.data as Borrower)?.id) {
        // Update existing
        await borrowerAPI.update((modal.data as Borrower).id, formData);
        setSuccessMessage('Borrower updated successfully');
      } else {
        // Create new
        await borrowerAPI.create(formData);
        setSuccessMessage('Borrower added successfully');
      }

      await loadBorrowersPage(true);
  await loadDashboardSummary();
  await loadDashboardResponseTrend();
      setModal({ type: null });
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to save borrower');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveLoan = async (formData: any) => {
    try {
      setSubmitting(true);
      setError('');

      if ((modal.data as LoanData)?.id) {
        // Update existing
        await loanAPI.update((modal.data as LoanData).id, formData);
        setSuccessMessage('Loan updated successfully');
        const borrowerId = (modal.data as LoanData).borrower_id;
        const updatedLoans = await loanAPI.getByBorrowerId(borrowerId);
        setLoansMap((prev) => ({
          ...prev,
          [borrowerId]: updatedLoans,
        }));
        await loadBorrowersPage(true);
        await loadDashboardSummary();
        await loadDashboardResponseTrend();
      } else {
        // Create new
        await loanAPI.create({ ...formData, borrower_id: modal.borrowerId });
        setSuccessMessage('Loan added successfully');
        const updatedLoans = await loanAPI.getByBorrowerId(modal.borrowerId!);
        setLoansMap((prev) => ({
          ...prev,
          [modal.borrowerId!]: updatedLoans,
        }));
        await loadBorrowersPage(true);
        await loadDashboardSummary();
        await loadDashboardResponseTrend();
      }

      setModal({ type: null });
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to save loan');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container dashboard-page">
      <ApplicationHeader />

      <div className="header dashboard-header">
        <div className="dashboard-title-block">
          <div>
            <h1>CFPB 1071 Dashboard</h1>
            <div className="dashboard-subtitle-row">
              <p>Manage borrower data collection requests</p>
              <button
                type="button"
                onClick={handleRefreshGraphs}
                className={`icon-btn dashboard-graphs-refresh-btn${graphsRefreshing ? ' is-refreshing' : ''}`}
                title="Refresh dashboard graphs"
                aria-label="Refresh dashboard graphs"
                disabled={graphsRefreshing}
              >
                <FiRefreshCw size={10} />
              </button>
            </div>
          </div>
          <div className="dashboard-meter-row">
            {renderDonutMeter(
              'dashboard-borrowers-meter',
              'Borrowers',
              '1071 submitted borrowers',
              summary.borrowers,
              '#a78bfa',
              summaryLoading,
              handleGraphTooltipMove,
              handleGraphTooltipLeave
            )}
            {renderDonutMeter(
              'dashboard-loans-meter',
              'Loans',
              '1071 submitted loans',
              summary.loans,
              '#8b5cf6',
              summaryLoading,
              handleGraphTooltipMove,
              handleGraphTooltipLeave
            )}
            {renderQuarterlyTrend(
              responseTrend,
              responseTrendLoading,
              handleGraphTooltipMove,
              handleGraphTooltipLeave
            )}
          </div>
        </div>
        <button
          onClick={handleDownloadExcel}
          className="dashboard-export-btn"
          title="Download data as CSV"
          style={{
            marginTop: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FiDownload size={10} />
          <span style={{ fontSize: '0.9rem' }}>Export Data</span>
        </button>
      </div>

      {graphTooltip && (
        <div
          className="graph-hover-tooltip"
          style={{ left: `${graphTooltip.x}px`, top: `${graphTooltip.y}px` }}
          role="status"
          aria-live="polite"
        >
          {graphTooltip.text}
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {successMessage && <div className="success">{successMessage}</div>}

      {loadingInitial ? (
        <div className="loading">Loading borrowers...</div>
      ) : (
        <div>
          <div style={{ marginBottom: '14px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              data-testid="dashboard-search-input"
              type="text"
              placeholder="Search borrower name, email, loan number, or loan amount (min 3 chars)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ width: '100%', maxWidth: '640px', flex: '1 1 420px' }}
            />
            <button
              data-testid="add-new-borrower-button"
              onClick={handleAddBorrower}
              style={{
                fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(0.5rem, 1vw, 0.75rem)',
              }}
            >
              <FiPlus size={10} />
              Add New Borrower
            </button>
          </div>

          <div className="dashboard-table-wrap">
          <table data-testid="borrowers-table">
            <thead>
              <tr>
                <th>Borrower Name</th>
                <th>Email</th>
                <th>Loans</th>
                <th>Requests</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {borrowers.map((borrower) => {
                const counts = getRequestCounts(borrower);
                return (
                  <React.Fragment key={borrower.id}>
                    <tr data-testid={`borrower-row-${borrower.id}`}>
                      <td>
                        {borrower.first_name} {borrower.last_name}
                      </td>
                      <td>{borrower.email}</td>
                      <td>{borrower.loan_count}</td>
                      <td>
                        <span className="summary-chip">
                          <FiBarChart2 size={8} />
                          Pending: <strong>{counts.pending}</strong> | Collected: <strong>{counts.collected}</strong>
                        </span>
                      </td>
                      <td className="dashboard-actions borrower-actions">
                        <button
                          onClick={() => handleExpandBorrower(borrower.id)}
                          className="icon-btn expand-toggle-btn"
                          title="Toggle loans"
                        >
                          {expandedBorrowerIds.includes(borrower.id) ? (
                            <FiChevronDown size={8} />
                          ) : (
                            <FiChevronRight size={8} />
                          )}
                        </button>
                        <button
                          onClick={() => handleEditBorrower(borrower)}
                          className="icon-btn"
                          title="Edit borrower"
                        >
                          <FiEdit size={8} />
                        </button>
                        <button
                          onClick={() => handleAddLoan(borrower.id)}
                          className="icon-btn"
                          title="Add loan"
                        >
                          <FiPlus size={8} />
                        </button>
                        <button
                          onClick={() => handleDeleteBorrower(borrower.id)}
                          className="icon-btn"
                          title="Delete borrower"
                        >
                          <FiTrash2 size={8} />
                        </button>
                      </td>
                    </tr>

                    {expandedBorrowerIds.includes(borrower.id) && (
                      <tr>
                        <td colSpan={5}>
                          <div style={{ padding: '20px' }}>
                            <h3>Loans for {borrower.first_name}</h3>
                            {loanLoadingMap[borrower.id] ? (
                              <p>Loading loans...</p>
                            ) : loansMap[borrower.id]?.length === 0 ? (
                              <p>No loans found for this borrower.</p>
                            ) : (
                              <div className="dashboard-table-wrap loans-table-wrap">
                              <table
                                className="loan-record-table"
                                style={{ marginTop: '10px', width: `${loanTableWidth}px`, minWidth: `${loanTableWidth}px` }}
                              >
                                <colgroup>
                                  {loanColumnWidths.map((width, index) => (
                                    <col key={LOAN_TABLE_COLUMN_HEADERS[index]} style={{ width: `${width}px` }} />
                                  ))}
                                </colgroup>
                                <thead>
                                  <tr>
                                    {LOAN_TABLE_COLUMN_HEADERS.map((label, index) => (
                                      <th key={label} className="loan-header-cell">
                                        <span className="loan-header-label">{label}</span>
                                        <span
                                          className="loan-column-resizer"
                                          onMouseDown={(event) => startLoanColumnResize(index, event)}
                                          role="separator"
                                          aria-orientation="vertical"
                                          aria-label={`Resize ${label} column`}
                                        />
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {loansMap[borrower.id]?.map((loan) => {
                                    const collectionStatus = getCollectionStatus(loan);
                                    const isSubmitted = collectionStatus.type === 'collected';

                                    return (
                                      <tr key={loan.id}>
                                        <td>{formatCurrency(loan.loan_amount)}</td>
                                        <td>
                                          {fmtDate(loan.loan_date)}
                                        </td>
                                        <td>
                                          {(() => {
                                            const full = `${loan.property_address}, ${loan.property_city}, ${loan.property_state} ${loan.property_zip}`;
                                            return <span className="address-clip" title={full}>{full}</span>;
                                          })()}
                                        </td>
                                        <td>{loan.line_of_business || 'Commercial Banking'}</td>
                                        <td>{loan.product_type || 'Term Loan'}</td>
                                        <td>{loan.loan_purpose}</td>
                                        <td>{loan.interest_rate}%</td>
                                        <td>
                                          <div>
                                            <span
                                              className={`badge badge-${collectionStatus.type}`}
                                            >
                                              {collectionStatus.status}
                                            </span>
                                            <div style={{ fontSize: '12px', marginTop: '4px', color: '#666' }}>
                                              {collectionStatus.timestamp
                                                ? collectionStatus.timestamp
                                                : ''}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="dashboard-actions loan-actions">
                                          {isSubmitted ? (
                                            <>
                                              <a
                                                href={`/form1071/${loan.request?.guid}?source=dashboard`}
                                                className="icon-btn"
                                                title="View submission"
                                              >
                                                <FiEye size={8} />
                                              </a>
                                              <button
                                                onClick={() =>
                                                  handleResend1071(loan, borrower.email)
                                                }
                                                disabled={resendingRequestId === loan.request?.id}
                                                className="icon-btn"
                                                title="Resend collection email"
                                              >
                                                {resendingRequestId === loan.request?.id ? (
                                                  <FiRefreshCw size={8} style={{ animation: 'spin 1s linear infinite' }} />
                                                ) : (
                                                  <FiRefreshCw size={8} />
                                                )}
                                              </button>
                                              <button
                                                onClick={() => handleEditLoan(loan)}
                                                className="icon-btn"
                                                title="Edit loan"
                                              >
                                                <FiEdit size={8} />
                                              </button>
                                              <button
                                                onClick={() => handleDeleteLoan(loan.id, borrower.id)}
                                                className="icon-btn"
                                                title="Delete loan"
                                              >
                                                <FiTrash2 size={8} />
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() =>
                                                  handleCollect1071(loan, borrower.email)
                                                }
                                                disabled={
                                                  processingLoanId === loan.id ||
                                                  collectionStatus.type === 'pending'
                                                }
                                                className="icon-btn"
                                                title={collectionStatus.type === 'pending' ? 'Pending' : 'Send 1071 request'}
                                              >
                                                {processingLoanId === loan.id
                                                  ? <FiRefreshCw size={8} style={{ animation: 'spin 1s linear infinite' }} />
                                                  : collectionStatus.type === 'pending'
                                                  ? <FiClock size={8} />
                                                  : <FiSend size={8} />}
                                              </button>
                                              {collectionStatus.type === 'pending' && (
                                                <button
                                                  onClick={() =>
                                                    handleResend1071(loan, borrower.email)
                                                  }
                                                  disabled={resendingRequestId === loan.request?.id}
                                                  className="icon-btn"
                                                  title="Resend collection email"
                                                >
                                                  {resendingRequestId === loan.request?.id ? (
                                                    <FiRefreshCw size={8} style={{ animation: 'spin 1s linear infinite' }} />
                                                  ) : (
                                                    <FiRefreshCw size={8} />
                                                  )}
                                                </button>
                                              )}
                                              <button
                                                onClick={() => handleEditLoan(loan)}
                                                className="icon-btn"
                                                title="Edit loan"
                                              >
                                                <FiEdit size={8} />
                                              </button>
                                              <button
                                                onClick={() => handleDeleteLoan(loan.id, borrower.id)}
                                                className="icon-btn"
                                                title="Delete loan"
                                              >
                                                <FiTrash2 size={8} />
                                              </button>
                                            </>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </div>

          {loadingMore && <div className="loading" style={{ marginTop: '12px' }}>Loading more borrowers...</div>}
          <div ref={loadMoreRef} data-testid="borrower-load-more-sentinel" style={{ height: 1 }} />

          {borrowers.length === 0 && !loadingInitial && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              {debouncedSearch
                ? 'No borrowers matched your search.'
                : 'No borrowers found. Please add borrowers to get started.'}
            </div>
          )}

        </div>
      )}

      {/* Modal for Editing Borrower */}
      {modal.type === 'borrower' && (
        <BorrowerModal
          borrower={modal.data as Borrower}
          onSave={handleSaveBorrower}
          onClose={() => setModal({ type: null })}
          submitting={submitting}
        />
      )}

      {/* Modal for Adding Borrower */}
      {modal.type === 'addBorrower' && (
        <BorrowerModal
          onSave={handleSaveBorrower}
          onClose={() => setModal({ type: null })}
          submitting={submitting}
        />
      )}

      {/* Modal for Editing Loan */}
      {modal.type === 'loan' && (
        <LoanModal
          loan={modal.data as LoanData}
          onSave={handleSaveLoan}
          onClose={() => setModal({ type: null })}
          submitting={submitting}
        />
      )}

      {/* Modal for Adding Loan */}
      {modal.type === 'addLoan' && (
        <LoanModal
          borrowerId={modal.borrowerId}
          onSave={handleSaveLoan}
          onClose={() => setModal({ type: null })}
          submitting={submitting}
        />
      )}
    </div>
  );
};

interface BorrowerModalProps {
  borrower?: Borrower;
  onSave: (data: any) => void;
  onClose: () => void;
  submitting: boolean;
}

const BorrowerModal: React.FC<BorrowerModalProps> = ({
  borrower,
  onSave,
  onClose,
  submitting,
}) => {
  const [formData, setFormData] = useState({
    first_name: borrower?.first_name || '',
    last_name: borrower?.last_name || '',
    email: borrower?.email || '',
  });

  // Sync form data when borrower changes (for editing)
  useEffect(() => {
    setFormData({
      first_name: borrower?.first_name || '',
      last_name: borrower?.last_name || '',
      email: borrower?.email || '',
    });
  }, [borrower]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>{borrower ? 'Edit Borrower' : 'Add New Borrower'}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Close"
          >
            <FiX size={12} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>First Name *</label>
            <input
              type="text"
              required
              value={formData.first_name}
              onChange={(e) =>
                setFormData({ ...formData, first_name: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Last Name *</label>
            <input
              type="text"
              required
              value={formData.last_name}
              onChange={(e) =>
                setFormData({ ...formData, last_name: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface LoanModalProps {
  loan?: LoanData;
  borrowerId?: string;
  onSave: (data: any) => void;
  onClose: () => void;
  submitting: boolean;
}

const LoanModal: React.FC<LoanModalProps> = ({
  loan,
  onSave,
  onClose,
  submitting,
}) => {
  const [formData, setFormData] = useState({
    loan_amount: loan?.loan_amount || '',
    loan_date: loan?.loan_date ? dayjs.utc(loan.loan_date).format('YYYY-MM-DD') : '',
    property_address: loan?.property_address || '',
    property_city: loan?.property_city || '',
    property_state: loan?.property_state || '',
    property_zip: loan?.property_zip || '',
    line_of_business: loan?.line_of_business || 'Commercial Banking',
    product_type: loan?.product_type || 'Term Loan',
    loan_purpose: loan?.loan_purpose || '',
    interest_rate: loan?.interest_rate || '',
  });

  // Sync form data when loan changes (for editing)
  useEffect(() => {
    setFormData({
      loan_amount: loan?.loan_amount || '',
      loan_date: loan?.loan_date ? dayjs.utc(loan.loan_date).format('YYYY-MM-DD') : '',
      property_address: loan?.property_address || '',
      property_city: loan?.property_city || '',
      property_state: loan?.property_state || '',
      property_zip: loan?.property_zip || '',
      line_of_business: loan?.line_of_business || 'Commercial Banking',
      product_type: loan?.product_type || 'Term Loan',
      loan_purpose: loan?.loan_purpose || '',
      interest_rate: loan?.interest_rate || '',
    });
  }, [loan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dateObj = new Date(`${formData.loan_date}T00:00:00Z`);
    onSave({
      ...formData,
      loan_amount: parseFloat(formData.loan_amount as any),
      interest_rate: parseFloat(formData.interest_rate as any),
      loan_date: dateObj.toISOString(),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>{loan ? 'Edit Loan' : 'Add New Loan'}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Close"
          >
            <FiX size={12} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label>Loan Amount *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.loan_amount}
                onChange={(e) =>
                  setFormData({ ...formData, loan_amount: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Loan Date *</label>
              <input
                type="date"
                required
                value={formData.loan_date}
                onChange={(e) =>
                  setFormData({ ...formData, loan_date: e.target.value })
                }
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Property Address *</label>
              <input
                type="text"
                required
                value={formData.property_address}
                onChange={(e) =>
                  setFormData({ ...formData, property_address: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>City *</label>
              <input
                type="text"
                required
                value={formData.property_city}
                onChange={(e) =>
                  setFormData({ ...formData, property_city: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>State *</label>
              <input
                type="text"
                maxLength={2}
                required
                value={formData.property_state}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    property_state: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
            <div className="form-group">
              <label>Zip Code *</label>
              <input
                type="text"
                required
                value={formData.property_zip}
                onChange={(e) =>
                  setFormData({ ...formData, property_zip: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Line of Business *</label>
              <select
                required
                value={formData.line_of_business}
                onChange={(e) =>
                  setFormData({ ...formData, line_of_business: e.target.value })
                }
              >
                <option value="Commercial Banking">Commercial Banking</option>
                <option value="Small Business Banking">Small Business Banking</option>
                <option value="Commercial Real Estate">Commercial Real Estate</option>
                <option value="Equipment Finance">Equipment Finance</option>
                <option value="Agribusiness">Agribusiness</option>
              </select>
            </div>
            <div className="form-group">
              <label>Product Type *</label>
              <select
                required
                value={formData.product_type}
                onChange={(e) =>
                  setFormData({ ...formData, product_type: e.target.value })
                }
              >
                <option value="Term Loan">Term Loan</option>
                <option value="Business Line of Credit">Business Line of Credit</option>
                <option value="Commercial Real Estate Loan">Commercial Real Estate Loan</option>
                <option value="Equipment Loan">Equipment Loan</option>
                <option value="Refinance Loan">Refinance Loan</option>
                <option value="SBA 7(a) Loan">SBA 7(a) Loan</option>
              </select>
            </div>
            <div className="form-group">
              <label>Loan Purpose *</label>
              <input
                type="text"
                required
                value={formData.loan_purpose}
                onChange={(e) =>
                  setFormData({ ...formData, loan_purpose: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Interest Rate (%) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.interest_rate}
                onChange={(e) =>
                  setFormData({ ...formData, interest_rate: e.target.value })
                }
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Dashboard;
