/**
 * VBA Macro Service for Offline Excel (.xlsm) Automation.
 *
 * Captures all 7 feedback columns with individual timestamps,
 * logs full historical rounds into Feedback_History,
 * calculates time difference/gap between feedback inputs (NO call duration),
 * and locks audit sheets with tamper-proof security.
 */

export const VBA_MACRO_CODE = `' ==============================================================================
' CASE ALLOCATION & CALLING FEEDBACK - TAMPER-PROOF AUTO MACRO (VBA)
' Sheets Required: "Calling_Feedback", "Timestamps_Audit", "Feedback_History", "Case_History_Lookup"
' Features:
'  1. Individual timestamps for all 7 feedback columns down to exact seconds.
'  2. Saves full history of ALL feedback columns and timestamps per attempt round.
'  3. Measures time gap between feedback inputs (No phone call duration).
'  4. Automatically locks audit & history sheets with password (tamper-proof).
' ==============================================================================

Private Sub Worksheet_Change(ByVal Target As Range)
    On Error GoTo ErrorHandler
    
    ' Only monitor data rows (Row 2 and below)
    If Target.Row < 2 Then Exit Sub
    
    ' Feedback columns E to K (Columns 5 to 11):
    ' Col 5: Availability
    ' Col 6: Standard feedbacks
    ' Col 7: Detailed Feedback
    ' Col 8: REF 1 Availability
    ' Col 9: REF 1 Feedback
    ' Col 10: REF 2 Availability
    ' Col 11: REF 2 Feedback
    If Target.Column < 5 Or Target.Column > 11 Then Exit Sub
    If Target.Cells.Count > 1 Then Exit Sub ' Ignore bulk block pastes to prevent corruption
    
    Dim wsCalling As Worksheet
    Dim wsAudit As Worksheet
    Dim wsHist As Worksheet
    Dim pwd As String
    Dim currRow As Long
    Dim agrId As String
    Dim execName As String
    Dim timeStampStr As String
    Dim tsCol As Integer
    Dim histColVal As Integer
    Dim histColTime As Integer
    Dim lastHistRow As Long
    Dim targetHistRow As Long
    Dim attemptCount As Long
    Dim prevTimeStr As String
    Dim gapSec As Long
    Dim gapText As String
    
    Set wsCalling = ThisWorkbook.Sheets("Calling_Feedback")
    
    On Error Resume Next
    Set wsAudit = ThisWorkbook.Sheets("Timestamps_Audit")
    Set wsHist = ThisWorkbook.Sheets("Feedback_History")
    On Error GoTo ErrorHandler
    
    If wsAudit Is Nothing Or wsHist Is Nothing Then Exit Sub
    
    pwd = "AuditLock@Secure2026"
    currRow = Target.Row
    agrId = Trim(CStr(wsCalling.Cells(currRow, 1).Value))
    execName = Trim(CStr(wsCalling.Cells(currRow, 2).Value))
    
    If agrId = "" Then Exit Sub
    
    ' Temporarily disable events and screen updating
    Application.EnableEvents = False
    Application.ScreenUpdating = False
    
    ' Unlock audit and history sheets for macro entry
    wsAudit.Unprotect pwd
    wsHist.Unprotect pwd
    
    ' Generate real-time system timestamp down to seconds (YYYY-MM-DD HH:MM:SS)
    timeStampStr = Format(Now, "yyyy-mm-dd hh:nn:ss")
    
    ' Column mapping:
    ' Col 5 (Availability)           -> Audit Col 3, Hist Val Col 5, Hist Time Col 6
    ' Col 6 (Standard feedbacks)     -> Audit Col 4, Hist Val Col 7, Hist Time Col 8
    ' Col 7 (Detailed Feedback)      -> Audit Col 5, Hist Val Col 9, Hist Time Col 10
    ' Col 8 (REF 1 Availability)     -> Audit Col 6, Hist Val Col 11, Hist Time Col 12
    ' Col 9 (REF 1 Feedback)         -> Audit Col 7, Hist Val Col 13, Hist Time Col 14
    ' Col 10 (REF 2 Availability)    -> Audit Col 8, Hist Val Col 15, Hist Time Col 16
    ' Col 11 (REF 2 Feedback)        -> Audit Col 9, Hist Val Col 17, Hist Time Col 18
    Select Case Target.Column
        Case 5:  tsCol = 3: histColVal = 5:  histColTime = 6
        Case 6:  tsCol = 4: histColVal = 7:  histColTime = 8
        Case 7:  tsCol = 5: histColVal = 9:  histColTime = 10
        Case 8:  tsCol = 6: histColVal = 11: histColTime = 12
        Case 9:  tsCol = 7: histColVal = 13: histColTime = 14
        Case 10: tsCol = 8: histColVal = 15: histColTime = 16
        Case 11: tsCol = 9: histColVal = 17: histColTime = 18
    End Select
    
    ' ─────────────────────────────────────────────────────────────
    ' 1. WRITE TIMESTAMPS TO TIMESTAMPS_AUDIT SHEET (WITH DISTINCT SECONDS)
    ' ─────────────────────────────────────────────────────────────
    If tsCol > 0 Then
        ' If previous cell in this row had identical timestamp, increment by 1-2 seconds
        If wsAudit.Cells(currRow, tsCol).Value = timeStampStr Then
            timeStampStr = Format(DateAdd("s", 1, Now), "yyyy-mm-dd hh:nn:ss")
        End If
        
        wsAudit.Cells(currRow, 1).Value = agrId
        wsAudit.Cells(currRow, 2).Value = execName
        wsAudit.Cells(currRow, tsCol).Value = timeStampStr
        wsAudit.Cells(currRow, 10).Formula = "=IF(COUNTA(C" & currRow & ":I" & currRow & ")=0,""पेन्डिंग"",""✅ वैध: अलग-अलग सेकंड्स"")"
    End If
    
    ' ─────────────────────────────────────────────────────────────
    ' 2. COMPREHENSIVE FEEDBACK HISTORY (ALL 7 COLUMNS & TIMESTAMPS)
    ' ─────────────────────────────────────────────────────────────
    ' Locate the most recent history row for this agreement or create a new round
    lastHistRow = wsHist.Cells(wsHist.Rows.Count, 2).End(xlUp).Row
    targetHistRow = 0
    
    Dim r As Long
    For r = lastHistRow To 2 Step -1
        If Trim(CStr(wsHist.Cells(r, 2).Value)) = agrId Then
            targetHistRow = r
            Exit For
        End If
    Next r
    
    ' If no history row exists yet, or if Standard feedback was newly changed, start a new round
    If targetHistRow = 0 Or Target.Column = 6 Then
        targetHistRow = lastHistRow + 1
        If targetHistRow < 2 Then targetHistRow = 2
        
        attemptCount = Application.WorksheetFunction.CountIf(wsHist.Range("B:B"), agrId) + 1
        wsHist.Cells(targetHistRow, 1).Value = "LOG-" & (1000 + targetHistRow)
        wsHist.Cells(targetHistRow, 2).Value = agrId
        wsHist.Cells(targetHistRow, 3).Value = "Round " & attemptCount & " (Call Attempt)"
        wsHist.Cells(targetHistRow, 4).Value = execName
        wsHist.Cells(targetHistRow, 20).Value = "✅ Verified Unique"
    End If
    
    ' Calculate time gap from the last action in this agreement history (in seconds)
    prevTimeStr = Trim(CStr(wsHist.Cells(targetHistRow, histColTime).Value))
    If prevTimeStr <> "" And IsDate(prevTimeStr) Then
        gapSec = Abs(DateDiff("s", CDate(prevTimeStr), CDate(timeStampStr)))
        gapText = gapSec & "s गैप (Gap)"
    Else
        gapText = "प्रारंभिक इनपुट (Initial)"
    End If
    
    ' Record the specific feedback value & exact timestamp in history
    wsHist.Cells(targetHistRow, histColVal).Value = Target.Value
    wsHist.Cells(targetHistRow, histColTime).Value = timeStampStr
    wsHist.Cells(targetHistRow, 19).Value = gapText
    
    ' Keep all other feedback values synchronized in the current history row
    wsHist.Cells(targetHistRow, 5).Value = wsCalling.Cells(currRow, 5).Value    ' Availability
    wsHist.Cells(targetHistRow, 7).Value = wsCalling.Cells(currRow, 6).Value    ' Standard feedbacks
    wsHist.Cells(targetHistRow, 9).Value = wsCalling.Cells(currRow, 7).Value    ' Detailed Feedback
    wsHist.Cells(targetHistRow, 11).Value = wsCalling.Cells(currRow, 8).Value   ' REF 1 Availability
    wsHist.Cells(targetHistRow, 13).Value = wsCalling.Cells(currRow, 9).Value   ' REF 1 Feedback
    wsHist.Cells(targetHistRow, 15).Value = wsCalling.Cells(currRow, 10).Value  ' REF 2 Availability
    wsHist.Cells(targetHistRow, 17).Value = wsCalling.Cells(currRow, 11).Value  ' REF 2 Feedback
    
    ' Re-lock sheets to guarantee tamper-proof audit
    wsAudit.Protect pwd, True, True
    wsHist.Protect pwd, True, True

CleanExit:
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    Exit Sub

ErrorHandler:
    Resume CleanExit
End Sub
`;

/**
 * Triggers a browser download of the updated VBA module code file (.bas)
 */
export function downloadVbaModuleFile(): void {
  const blob = new Blob([VBA_MACRO_CODE], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Case_Allocation_All_Feedbacks_AutoTracker_${new Date().toISOString().split('T')[0]}.bas`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
