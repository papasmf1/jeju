# 함수연습2.py
#전역변수
x = 20 

def printX():
    #지역변수
    #x = 5 
    #외부에 있는 전역 변수에 쓰기
    global x
    x += 5 
    print("함수 내부:", x)

#함수 호출
printX()
print("함수 외부:", x)

