#에러처리.py 
#함수 
def divide(a, b):
    return a/b 

#에러 처리
try: 
    #함수를 호출
    result = divide(10, 2)
except ZeroDivisionError:
    print("0으로 나눌 수 없습니다.")
except TypeError:
    print("잘못된 타입입니다.")
else:
    print(result)
finally:
    print("무조건 실행")
    
print("전체 코드 실행 종료")

