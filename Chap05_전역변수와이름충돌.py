#전역변수(공유 데이터)
strName = "전역변수의 값"

#1)클래스 정의(쿠키틀)
class DemoString:
    def __init__(self):
        #멤버변수 
        self.strName = "" 
        self.age = 20 
    def set(self, msg):
        self.strName = msg
    def print(self):
        #개발자 실수(버그)
        print(self.strName)
        print(self.age)

#2)인스턴스 생성 및 메서드 호출
d = DemoString()
d.set("멤버변수에 셋팅")
d.print()

#나이를 추가


