# 클래스 연습.py 
#1)클래스 정의 
class Person:
    #초기화 메서드
    def __init__(self, name):
        self.name = name

    #인스턴스 메서드
    def greet(self):
        print("Hello, my name is", self.name)

#2)인스턴스 생성
person1 = Person("Alice")
person2 = Person("Bob")

#3)메서드 호출
person1.greet()
person2.greet()
