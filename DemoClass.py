# Person 클래스 정의
class Person:
    def __init__(self, id, name):
        self.id = id
        self.name = name
    
    def printInfo(self):
        print(f"ID: {self.id}, Name: {self.name}")


# Manager 클래스 - Person 상속
class Manager(Person):
    def __init__(self, id, name, title):
        super().__init__(id, name)
        self.title = title
    
    def printInfo(self):
        super().printInfo()
        print(f"Title: {self.title}")


# Employee 클래스 - Person 상속
class Employee(Person):
    def __init__(self, id, name, skill):
        super().__init__(id, name)
        self.skill = skill
    
    def printInfo(self):
        super().printInfo()
        print(f"Skill: {self.skill}")


# 10개의 인스턴스를 생성하는 샘플 코드
if __name__ == "__main__":
    # Manager 인스턴스 5개 생성
    managers = [
        Manager(1, "Alice", "Senior Manager"),
        Manager(2, "Bob", "Project Manager"),
        Manager(3, "Charlie", "Team Lead"),
        Manager(4, "Diana", "Department Head"),
        Manager(5, "Eve", "Operations Manager")
    ]
    
    # Employee 인스턴스 5개 생성
    employees = [
        Employee(6, "Frank", "Python"),
        Employee(7, "Grace", "Java"),
        Employee(8, "Henry", "JavaScript"),
        Employee(9, "Ivy", "Database Design"),
        Employee(10, "Jack", "DevOps")
    ]
    
    # 모든 인스턴스의 정보 출력
    print("=== Manager 정보 ===")
    for manager in managers:
        manager.printInfo()
        print()
    
    print("=== Employee 정보 ===")
    for employee in employees:
        employee.printInfo()
        print()
