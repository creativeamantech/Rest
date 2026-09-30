export interface AllocationItem {
  agreementId: string;
  executiveName: string;
  allocationDate: string;
  status: 'Allocated' | 'Unallocated' | 'Transferred' | 'Paid' | 'Closed' | string;
  lastUpdated?: string;
  notes?: string;
  rowIndex?: number; // 1-based index in sheet if known
}

export interface TransferLogItem {
  timestamp: string;
  agreementId: string;
  fromExecutive: string;
  toExecutive: string;
  transferredBy: string;
  reason: string;
}

export interface ParsedTransferRow {
  agreementId: string;
  fromExecutive: string;
  toExecutive: string;
  isValid: boolean;
  validationError?: string;
  isExistingAgreement: boolean;
  actionType: 'Transfer' | 'New Allocation' | 'Same Executive';
}

export interface ParsedAllocationRow {
  agreementId: string;
  executiveName: string;
  allocationDate: string;
  status: string;
  notes?: string;
  isValid: boolean;
  validationError?: string;
  isDuplicate?: boolean;
}

export interface SpreadsheetInfo {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface UserAccount {
  username: string;
  password: string;
  fullName: string;
  role: 'Admin' | 'Executive';
  status: 'Active' | 'Inactive';
  createdDate?: string;
  rowIndex?: number;
}

export interface AuthSession {
  username: string;
  fullName: string;
  role: 'Admin' | 'Executive';
  loggedInAt: string;
}

export interface FeedbackUploadItem {
  agreementId: string;
  executiveName: string;
  allocationDate?: string;
  status: string;
  availability: string;
  availTime?: string;
  standardFeedbacks: string;
  sfTime?: string;
  detailedFeedback: string;
  dfTime?: string;
  ref1Availability: string;
  r1aTime?: string;
  ref1Feedback: string;
  r1fTime?: string;
  ref2Availability: string;
  r2aTime?: string;
  ref2Feedback: string;
  r2fTime?: string;
  timeGap?: string;
  isValid: boolean;
  validationError?: string;
  auditFlag: 'Valid' | 'DuplicateTimestamp' | 'MissingTime' | 'Unassigned';
}

export interface FeedbackUploadBatchLog {
  id: string;
  timestamp: string;
  uploadedBy: string;
  executiveName: string;
  fileName: string;
  totalCases: number;
  updatedCount: number;
  statusBreakdown: Record<string, number>;
  auditStatus: string;
}

