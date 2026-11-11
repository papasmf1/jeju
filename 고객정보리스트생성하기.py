# -*- coding: utf-8 -*-
"""
1) 1000명의 가상 고객 정보(이름, 날짜, 지점)를 생성해서 customer.xlsx 에 저장
2) customer.xlsx 를 다시 읽어서 템플릿으로 상담 확정 메시지를 출력

필요 패키지: pip install openpyxl
"""
import os
import random

from openpyxl import Workbook, load_workbook

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_PATH = os.path.join(BASE_DIR, "customer.xlsx")
CUSTOMER_COUNT = 1000

LAST_NAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
              "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"]
FIRST_NAMES = ["철수", "영희", "민준", "서연", "도윤", "하은", "지호", "수아",
               "예준", "지우", "현우", "민서", "건우", "서윤", "우진", "지민",
               "준서", "채원", "시우", "유진", "태민", "다은", "성민", "나연"]
PLACES = ["강남점", "홍대점", "신촌점", "잠실점", "종로점",
          "여의도점", "판교점", "분당점", "수원점", "인천점"]


# ---------------------------------------------------------------
# 1. 고객 정보 1000명 생성 → customer.xlsx 저장
# ---------------------------------------------------------------
def create_customer_excel(path, count):
    wb = Workbook()
    ws = wb.active
    ws.title = "customers"
    ws.append(["name", "date", "place"])  # 헤더 = 템플릿의 키 이름

    for _ in range(count):
        name = random.choice(LAST_NAMES) + random.choice(FIRST_NAMES)
        month = random.randint(1, 12)
        day = random.randint(1, 28)
        date = f"{month}월 {day}일"
        place = random.choice(PLACES)
        ws.append([name, date, place])

    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["B"].width = 12
    ws.column_dimensions["C"].width = 12
    wb.save(path)
    print(f"[완료] {count}명의 고객 정보를 저장했습니다: {path}\n")


# ---------------------------------------------------------------
# 2. customer.xlsx 읽기 → customers 리스트(딕셔너리) 만들기
# ---------------------------------------------------------------
def load_customers(path):
    wb = load_workbook(path, read_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    customers = [dict(zip(header, row)) for row in rows if row[0]]
    wb.close()
    return customers


if __name__ == "__main__":
    create_customer_excel(EXCEL_PATH, CUSTOMER_COUNT)

    template = "{name}님, {date} 상담이 확정되었습니다. ({place})"

    customers = load_customers(EXCEL_PATH)
    for c in customers:
        print(template.format(**c))

    print(f"\n총 {len(customers)}건의 메시지를 출력했습니다.")
