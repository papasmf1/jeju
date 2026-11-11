#match_case구문.py

key = input("숫자를 입력:")

match key:
    case "1":
        print("112")
    case "2" | "3":
        print("가족")
    case _:
        print("미등록")


score = int(input("점수를 입력:"))

match score:
    case n if n >= 90:
        print("A")
    case n if n >= 80:
        print("B")
    case _:
        print("C")

cmd = input("명령: ").split()
match cmd:
    case ["go", direction]:
        print(f"{direction}로 이동")
    case ["quit"]:
        print("종료")
    case _:
        print("알 수 없는 명령")


user = {"role": "admin",
        "name": "홍길동"}
match user:
    case {"role": "admin", "name": n}:
        print(f"관리자 {n}")
    case {"role": "guest"}:
        print("손님")
    case _:
        print("일반 사용자")
