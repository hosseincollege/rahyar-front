import os
import re
from copy import copy
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter


path = Path(os.environ["SOURCE_XLSX"])
workbook = load_workbook(path)
sheet = workbook[workbook.sheetnames[0]]


def normalize_digits(value):
    return str(value or "").translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))


def bill_id(value):
    return re.sub(r"\D", "", normalize_digits(value))


headers = {str(sheet.cell(1, column).value or "").strip(): column for column in range(1, sheet.max_column + 1)}
columns = {
    "row": headers["ردیف"],
    "bill": headers["شناسه قبض"],
    "meter": headers["شماره بدنه کنتور"],
    "customer": headers["نام مشترک"],
    "area": headers["منطقه / امور"],
    "address": headers["آدرس انشعاب"],
    "review": headers["وضعیت بررسی"],
    "payment_id": headers["شناسه پرداخت"],
    "avg": headers["میانگین مصرف ماهانه (kWh)"],
    "usage": headers["مصرف دوره (kWh)"],
    "bill_amount": headers["مبلغ دوره (ریال)"],
    "previous_debt": headers["بدهی پیشین (ریال)"],
    "payable": headers["مبلغ قابل پرداخت (ریال)"],
    "deadline": headers["مهلت پرداخت"],
    "payment_status": headers["وضعیت پرداخت"],
    "distribution": headers["شرکت توزیع"],
    "system_code": headers["کد سامانه"],
    "phase": headers["فاز"],
    "amps": headers["آمپر"],
    "power": headers["قدرت قراردادی (kW)"],
    "notes": headers["یادداشت پیگیری"],
}

existing = {}
for row_number in range(2, sheet.max_row + 1):
    key = bill_id(sheet.cell(row_number, columns["bill"]).value)
    if key:
        existing[key] = row_number


def set_if_blank(row_number, field, value, replace_placeholders=False):
    if value is None:
        return
    cell = sheet.cell(row_number, columns[field])
    empty = cell.value is None or str(cell.value).strip() == ""
    if replace_placeholders:
        empty = empty or str(cell.value).strip() in {"-", "—", "–"}
    if empty:
        cell.value = value


def add_note(row_number, note):
    cell = sheet.cell(row_number, columns["notes"])
    if cell.value and str(cell.value).strip():
        if note not in str(cell.value):
            cell.value = f"{cell.value}\n{note}"
    else:
        cell.value = note
    cell.alignment = copy(cell.alignment)
    cell.alignment = Alignment(
        horizontal=cell.alignment.horizontal,
        vertical=cell.alignment.vertical or "top",
        text_rotation=cell.alignment.text_rotation,
        wrap_text=True,
        shrink_to_fit=cell.alignment.shrink_to_fit,
        indent=cell.alignment.indent,
        relativeIndent=cell.alignment.relativeIndent,
        justifyLastLine=cell.alignment.justifyLastLine,
        readingOrder=cell.alignment.readingOrder,
    )
    sheet.row_dimensions[row_number].height = max(sheet.row_dimensions[row_number].height or 38, 60)


updates = {
    "7996576602220": {
        "payment_id": "1466150665",
        "bill_amount": 14661000,
        "payable": 14661000,
        "deadline": "۱۴۰۵/۰۷/۱۸",
        "payment_status": "پرداخت نشده - اخطار جمع‌آوری",
        "notes": "یادآوری قبض برق و اخطار جمع‌آوری شهرستان فریدن؛ مهلت پرداخت اعلام‌شده ۲۴ ساعت است.",
    },
    "7027733002221": {
        "payment_id": "6201250678",
        "payable": 62012000,
        "payment_status": "پرداخت نشده - اخطار جمع‌آوری",
        "notes": "اخطار جمع‌آوری برق شهرستان برخوار؛ بدهی اعلام‌شده ۶۲٬۰۱۲٬۰۰۰ ریال و مهلت اقدام ۲۴ ساعت است.",
    },
    "7954079102228": {
        "area": "کاشان",
        "payment_id": "268550476",
        "previous_debt": 2685000,
        "payable": 2685000,
        "payment_status": "پرداخت نشده - اخطار اعمال قانون",
        "notes": "بدهی شش‌ماهه ۲٬۶۸۵٬۰۰۰ ریال؛ رمز رایانه ۹۵۴۰۷۹۱۹، ردیف قبض ۰۰۵۰. لینک پرداخت: https://bargheman.com/b/7954079102228؛ پشتیبانی: ۳۷۱۲۱.",
    },
    "7970507102225": {
        "payment_id": "8631750460",
        "payable": 86317000,
        "payment_status": "پرداخت نشده - اخطار جمع‌آوری",
        "notes": "اخطار جمع‌آوری برق شهرستان سمیرم؛ بدهی اعلام‌شده ۸۶٬۳۱۷٬۰۰۰ ریال و مهلت اقدام ۲۴ ساعت است.",
    },
}

for identifier, fields in updates.items():
    row_number = existing.get(identifier)
    if row_number is None:
        raise ValueError(f"Expected existing bill identifier was not found: {identifier}")
    for field, value in fields.items():
        if field == "notes":
            add_note(row_number, value)
        else:
            set_if_blank(row_number, field, value, replace_placeholders=(field == "area"))


new_records = [
    {
        "bill": "7961699402228",
        "meter": "11119801774909",
        "customer": "اداره حمل و نقل و پایانه‌های استان اصفهان",
        "address": "جاده اصفهان به دلیجان، کیلومتر ۲۰، روبه‌روی باغ بلوریان، دوربین کنترل سرعت",
        "review": "اطلاعات قبض از تصویر ثبت شد",
        "payment_id": "3104450296",
        "avg": 84,
        "usage": 177,
        "bill_amount": 7222834,
        "previous_debt": 23821756,
        "payable": 31044000,
        "deadline": "۱۴۰۵/۰۶/۱۷",
        "payment_status": "پرداخت نشده",
        "distribution": "استان اصفهان",
        "phase": "تک‌فاز",
        "amps": 15,
        "power": 30,
        "notes": "برچسب ارسالی کاربر: رهکام، باغ بلوریان.",
    },
    {
        "bill": "7024551302220",
        "customer": "شرکت توزین الکتریک",
        "area": "نایین",
        "review": "اطلاعیه بدهی از پیامک دریافت شد",
        "payment_id": "15353150404",
        "payable": 153531000,
        "payment_status": "پرداخت نشده - اخطار جمع‌آوری",
        "notes": "اخطار جمع‌آوری برق شهرستان نایین؛ بدهی اعلام‌شده ۱۵۳٬۵۳۱٬۰۰۰ ریال و مهلت اقدام ۲۴ ساعت است. پیامک تکراری بود و یک‌بار ثبت شد.",
    },
    {
        "bill": "7961741802223",
        "customer": "سامانه ثبت تخلفات سرعت",
        "area": "میمه",
        "address": "میمه، جاده اصفهان، جنب گلپایگان",
        "review": "اطلاعات قبض از تصویر ثبت شد",
        "payment_id": "7201650403",
        "avg": 191,
        "usage": 4058,
        "bill_amount": 17994096,
        "previous_debt": 54032693,
        "payable": 72016000,
        "deadline": "۱۴۰۵/۰۷/۱۲",
        "payment_status": "پرداخت نشده",
        "distribution": "استان اصفهان",
        "meter": "2219420267488",
        "phase": "تک‌فاز",
        "amps": 15,
        "power": 30,
    },
]

last_data_index = max((int(sheet.cell(r, columns["row"]).value) for r in range(2, sheet.max_row + 1) if str(sheet.cell(r, columns["row"]).value or "").isdigit()), default=0)
style_source_row = sheet.max_row
added = []
for record in new_records:
    key = record["bill"]
    row_number = existing.get(key)
    if row_number is None:
        row_number = sheet.max_row + 1
        for column in range(1, sheet.max_column + 1):
            source_cell = sheet.cell(style_source_row, column)
            target_cell = sheet.cell(row_number, column)
            if source_cell.has_style:
                target_cell._style = copy(source_cell._style)
            if source_cell.number_format:
                target_cell.number_format = source_cell.number_format
            if source_cell.alignment:
                target_cell.alignment = copy(source_cell.alignment)
        sheet.row_dimensions[row_number].height = 60
        last_data_index += 1
        sheet.cell(row_number, columns["row"]).value = last_data_index
        sheet.cell(row_number, columns["bill"]).value = key
        existing[key] = row_number
        added.append(key)
    for field, value in record.items():
        if field == "bill":
            continue
        set_if_blank(row_number, field, value, replace_placeholders=(field == "area"))


photo_sheet_name = "تصاویر نیازمند تطبیق"
if photo_sheet_name in workbook.sheetnames:
    photo_sheet = workbook[photo_sheet_name]
    photo_sheet.delete_rows(1, photo_sheet.max_row)
else:
    photo_sheet = workbook.create_sheet(photo_sheet_name)
photo_sheet.sheet_view.rightToLeft = True
photo_sheet.freeze_panes = "A2"
photo_headers = ["کد سامانه", "شماره بدنه / سریال روی تصویر", "شماره ردیف تصویر", "وضعیت تطبیق"]
for column, value in enumerate(photo_headers, start=1):
    cell = photo_sheet.cell(1, column, value)
    cell.font = Font(name="Tahoma", bold=True, color="FFFFFF")
    cell.fill = PatternFill("solid", fgColor="263445")
    cell.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)
photo_values = [
    "007W13027",
    "11-01-03-03482341",
    "23",
    "شناسه قبض در تصویر مشخص نیست؛ برای اتصال به ردیف اصلی نیاز به تطبیق شناسه قبض است.",
]
for column, value in enumerate(photo_values, start=1):
    cell = photo_sheet.cell(2, column, value)
    cell.font = Font(name="Tahoma", size=10)
    cell.alignment = Alignment(horizontal="right", vertical="top", wrap_text=True)
photo_sheet.row_dimensions[1].height = 34
photo_sheet.row_dimensions[2].height = 48
for column, width in enumerate([18, 27, 18, 72], start=1):
    photo_sheet.column_dimensions[get_column_letter(column)].width = width
photo_sheet.auto_filter.ref = "A1:D2"

sheet.auto_filter.ref = f"A1:{get_column_letter(sheet.max_column)}{sheet.max_row}"
workbook.save(path)
print(f"Updated {path}; added {len(added)} records; total data rows {sheet.max_row - 1}; unmatched photo logged on '{photo_sheet_name}'.")
