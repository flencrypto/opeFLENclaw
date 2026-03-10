; OpenClaw Windows Installer
; Build with: makensis /DVERSION=<ver> /DOUTFILE=<out.exe> /DSRCDIR=<app-dir> /DNODEDIR=<node-dir> windows-installer.nsi

Unicode true
SetCompressor /SOLID lzma

!include "MUI2.nsh"

; ------------------------------------------------------------------
; Build-time defines (passed via /D on the makensis command line)
; ------------------------------------------------------------------
!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef OUTFILE
  !define OUTFILE "OpenClaw-Setup.exe"
!endif
!ifndef SRCDIR
  !define SRCDIR "staging\app"
!endif
!ifndef NODEDIR
  !define NODEDIR "staging\node"
!endif

; ------------------------------------------------------------------
; Basic metadata
; ------------------------------------------------------------------
!define APP_NAME   "OpenClaw"
!define APP_EXE    "openclaw.cmd"
!define PUBLISHER  "OpenClaw"
!define APP_URL    "https://openclaw.ai"
!define REG_ENV    "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"
!define REG_UNINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenClaw"

Name          "${APP_NAME} ${VERSION}"
OutFile       "${OUTFILE}"
InstallDir    "$PROGRAMFILES64\OpenClaw"
InstallDirRegKey HKLM "${REG_UNINST}" "InstallLocation"
RequestExecutionLevel admin
BrandingText  "${APP_NAME} ${VERSION}"

; ------------------------------------------------------------------
; Modern UI pages
; ------------------------------------------------------------------
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${SRCDIR}\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_SHOWREADME ""
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ------------------------------------------------------------------
; Helper: append a directory to the system PATH (no duplicates)
; ------------------------------------------------------------------
!macro AddToPath dir
  ReadRegStr $R0 HKLM "${REG_ENV}" "PATH"
  ; Only append if not already present
  Push "$R0"
  Push "${dir}"
  Call StrStr
  Pop $R1
  StrCmp $R1 "" 0 +3
    WriteRegExpandStr HKLM "${REG_ENV}" "PATH" "$R0;${dir}"
    SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=500
!macroend

; ------------------------------------------------------------------
; Helper: remove a directory from the system PATH
; ------------------------------------------------------------------
!macro RemoveFromPath dir
  ReadRegStr $R0 HKLM "${REG_ENV}" "PATH"
  Push "${dir};"
  Push $R0
  Call un.StrReplace
  Pop $R0
  WriteRegExpandStr HKLM "${REG_ENV}" "PATH" "$R0"
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=500
!macroend

; StrStr — find $R1 inside $R0; returns "" if not found
Function StrStr
  Exch $R1   ; search string
  Exch
  Exch $R0   ; haystack
  Push $R2
  Push $R3
  StrLen $R3 $R1
  StrCpy $R2 0
  loop:
    StrCpy $R4 $R0 $R3 $R2
    StrCmp $R4 $R1 found
    StrCmp $R4 "" done
    IntOp $R2 $R2 + 1
    Goto loop
  found:
    StrCpy $R4 $R0 "" $R2
    Goto end
  done:
    StrCpy $R4 ""
  end:
  Pop $R3
  Pop $R2
  Pop $R0
  Exch $R1
  Exch
  Pop $R1
  Exch
  Push $R4
FunctionEnd

; un.StrReplace — in $R0 (stack top) replace all occurrences of $R1 (param) with ""
Function un.StrReplace
  Exch $R2   ; needle
  Exch
  Exch $R1   ; haystack
  Push $R3
  Push $R4
  Push $R5
  StrCpy $R3 ""           ; result buffer
  StrLen $R4 $R2          ; needle length
  loop:
    StrLen $R5 $R1
    StrCmp $R5 "0" done   ; haystack empty → done
    StrCpy $R5 $R1 $R4    ; read $R4 chars from start of haystack
    StrCmp $R5 $R2 strip  ; needle match? skip it
    ; No match: append first char of haystack to result, advance by 1
    StrCpy $R5 $R1 1
    StrCpy $R3 "$R3$R5"
    StrCpy $R1 $R1 "" 1
    Goto loop
  strip:
    ; Match: advance haystack by needle length without appending
    StrCpy $R1 $R1 "" $R4
    Goto loop
  done:
  Pop $R5
  Pop $R4
  Pop $R1
  Exch $R2
  Exch
  Push $R3
FunctionEnd

; ------------------------------------------------------------------
; Install section
; ------------------------------------------------------------------
Section "OpenClaw" SecMain
  SectionIn RO

  SetOutPath "$INSTDIR"

  ; --- Node.js portable runtime ---
  File /r "${NODEDIR}\*"

  ; --- Application files ---
  File /r "${SRCDIR}\*"

  ; --- Launcher script: forwards all arguments to the CLI entry point ---
  FileOpen  $0 "$INSTDIR\openclaw.cmd" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "setlocal$\r$\n"
  FileWrite $0 '"%~dp0node.exe" "%~dp0openclaw.mjs" %*$\r$\n'
  FileClose $0

  ; --- Add install dir to system PATH ---
  !insertmacro AddToPath "$INSTDIR"

  ; --- Start Menu shortcut ---
  CreateDirectory "$SMPROGRAMS\OpenClaw"
  CreateShortcut  "$SMPROGRAMS\OpenClaw\OpenClaw CLI.lnk" \
                  "$WINDIR\System32\cmd.exe" '/k "$INSTDIR\openclaw.cmd" --help'

  ; --- Registry: uninstall entry ---
  WriteRegStr   HKLM "${REG_UNINST}" "DisplayName"     "${APP_NAME} ${VERSION}"
  WriteRegStr   HKLM "${REG_UNINST}" "DisplayVersion"  "${VERSION}"
  WriteRegStr   HKLM "${REG_UNINST}" "Publisher"       "${PUBLISHER}"
  WriteRegStr   HKLM "${REG_UNINST}" "URLInfoAbout"    "${APP_URL}"
  WriteRegStr   HKLM "${REG_UNINST}" "InstallLocation" "$INSTDIR"
  WriteRegStr   HKLM "${REG_UNINST}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegDWORD HKLM "${REG_UNINST}" "NoModify"        1
  WriteRegDWORD HKLM "${REG_UNINST}" "NoRepair"        1

  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

; ------------------------------------------------------------------
; Uninstall section
; ------------------------------------------------------------------
Section "Uninstall"
  ; Remove install dir from PATH
  !insertmacro RemoveFromPath "$INSTDIR"

  ; Remove Start Menu shortcut
  Delete "$SMPROGRAMS\OpenClaw\OpenClaw CLI.lnk"
  RMDir  "$SMPROGRAMS\OpenClaw"

  ; Remove registry entry
  DeleteRegKey HKLM "${REG_UNINST}"

  ; Remove files and directory
  RMDir /r "$INSTDIR"
SectionEnd
