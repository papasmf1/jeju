class Person:
    def __init__(self, id, name):
        """
        Person 클래스의 생성자입니다.

        :param id: Person의 ID
        :param name: Person의 이름
        """
        self.id = id
        self.name = name

    def printInfo(self):
        """
        Person 정보를 출력하는 메서드입니다.
        """
        print(f"ID: {self.id}, Name: {self.name}")


class Manager(Person):
    def __init__(self, id, name, title):
        """
        Manager 클래스의 생성자입니다.

        :param id: Manager의 ID
        :param name: Manager의 이름
        :param title: Manager의 직책 (Title)
        """
        super().__init__(id, name)
        self.title = title

    def printInfo(self):
        """
        Manager 정보를 출력하는 메서드입니다.
        """
        super().printInfo()
        print(f"Title: {self.title}")


class Employee(Person):
    def __init__(self, id, name, skill):
        """
        Employee 클래스의 생성자입니다.

        :param id: Employee의 ID
        :param name: Employee의 이름
        :param skill: Employee의 기술 스킬
        """
        super().__init__(id, name)
        self.skill = skill

    def printInfo(self):
        """
        Employee 정보를 출력하는 메서드입니다.
        """
        super().printInfo()
        print(f"Skill: {self.skill}")


# 10개의 샘플 객체 생성
people = [
    Manager(1, "매니저 1", "시니어 매니저"),
    Manager(2, "매니저 2", "주니어 매니저"),
    Employee(3, "직원 1", "Python"),
    Employee(4, "직원 2", "Java"),
    Employee(5, "직원 3", "C++"),
    Employee(6, "직원 4", "JavaScript"),
    Employee(7, "직원 5", "Ruby"),
    Employee(8, "직원 6", "SQL"),
    Employee(9, "직원 7", "React"),
    Employee(10, "직원 8", "Angular")
]

# 생성된 객체 정보 출력
for person in people:
    person.printInfo()
    print()

p1 = Person(100, "김유신")
p1.printInfo() 
