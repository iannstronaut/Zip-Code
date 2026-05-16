#!/usr/bin/env python3
"""
ZIP CODE - Continuous Improvement Monitor
Monitors project health and suggests improvements
"""

import json
import subprocess
import sys
from pathlib import Path
from datetime import datetime

def run_command(cmd):
    """Run shell command and return output"""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=30
        )
        return result.stdout.strip(), result.returncode
    except Exception as e:
        return str(e), 1

def check_git_status():
    """Check if there are uncommitted changes"""
    output, code = run_command("git status --porcelain")
    return len(output) > 0, output

def check_todos():
    """Count TODO/FIXME comments"""
    output, _ = run_command(
        'grep -r "TODO\\|FIXME" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l'
    )
    return int(output) if output.isdigit() else 0

def check_test_coverage():
    """Check if tests exist"""
    output, _ = run_command("find test/ -name '*.test.ts' 2>/dev/null | wc -l")
    return int(output) if output.isdigit() else 0

def check_dependencies():
    """Check for outdated dependencies"""
    output, _ = run_command("npm outdated --json 2>/dev/null")
    try:
        outdated = json.loads(output) if output else {}
        return len(outdated)
    except:
        return 0

def check_build():
    """Check if project builds successfully"""
    output, code = run_command("npm run build 2>&1")
    return code == 0, output

def generate_report():
    """Generate improvement report"""
    report = {
        "timestamp": datetime.now().isoformat(),
        "checks": {}
    }

    # Check git status
    has_changes, changes = check_git_status()
    report["checks"]["uncommitted_changes"] = {
        "status": "warning" if has_changes else "ok",
        "count": len(changes.split("\n")) if has_changes else 0
    }

    # Check TODOs
    todo_count = check_todos()
    report["checks"]["todos"] = {
        "status": "warning" if todo_count > 10 else "ok",
        "count": todo_count
    }

    # Check tests
    test_count = check_test_coverage()
    report["checks"]["tests"] = {
        "status": "warning" if test_count < 5 else "ok",
        "count": test_count
    }

    # Check dependencies
    outdated_count = check_dependencies()
    report["checks"]["outdated_dependencies"] = {
        "status": "warning" if outdated_count > 5 else "ok",
        "count": outdated_count
    }

    # Check build
    build_ok, build_output = check_build()
    report["checks"]["build"] = {
        "status": "ok" if build_ok else "error",
        "message": "Build successful" if build_ok else "Build failed"
    }

    return report

def format_report(report):
    """Format report for display"""
    lines = [
        "🔍 ZIP CODE - Health Check Report",
        f"📅 {report['timestamp']}",
        "",
        "Status:"
    ]

    for check, data in report["checks"].items():
        status_icon = {
            "ok": "✅",
            "warning": "⚠️",
            "error": "❌"
        }.get(data["status"], "❓")

        check_name = check.replace("_", " ").title()
        
        if "count" in data:
            lines.append(f"{status_icon} {check_name}: {data['count']}")
        elif "message" in data:
            lines.append(f"{status_icon} {check_name}: {data['message']}")

    # Add recommendations
    warnings = [k for k, v in report["checks"].items() if v["status"] == "warning"]
    errors = [k for k, v in report["checks"].items() if v["status"] == "error"]

    if errors or warnings:
        lines.append("")
        lines.append("📋 Recommendations:")
        
        if errors:
            lines.append("  🔴 Critical:")
            for error in errors:
                lines.append(f"    - Fix {error.replace('_', ' ')}")
        
        if warnings:
            lines.append("  🟡 Improvements:")
            for warning in warnings:
                lines.append(f"    - Address {warning.replace('_', ' ')}")
    else:
        lines.append("")
        lines.append("🎉 All checks passed! Project is healthy.")

    return "\n".join(lines)

def main():
    """Main function"""
    try:
        report = generate_report()
        formatted = format_report(report)
        print(formatted)
        
        # Save report
        report_dir = Path(".hermes/reports")
        report_dir.mkdir(parents=True, exist_ok=True)
        
        report_file = report_dir / f"health-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        with open(report_file, "w") as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Report saved: {report_file}")
        
        # Exit with error if there are critical issues
        has_errors = any(v["status"] == "error" for v in report["checks"].values())
        sys.exit(1 if has_errors else 0)
        
    except Exception as e:
        print(f"❌ Error generating report: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
