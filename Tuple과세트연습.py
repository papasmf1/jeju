# Tuple과세트연습.py 
tp = (100, 200, 300)
print(type(tp))
print(len(tp))
print(tp.index(300))
print(tp.count(200))

#함수를 정의
def times(a,b):
    return a*b, a+b 

#함수를 호출
result = times(3,4)
print(result)

#한방에 입력
args = (5,6)
#파이썬 변수명 앞에 *tuple 힌트 
print(times(*args))

#세트형식
a = {1,2,3,3}
b = {3,4,4,5}
print(a)
print(b)
print(a.union(b))
print(a.intersection(b))
print(a.difference(b))

#형식변환
a = (10,20,30)
b = list(a)
print(b)
b.append(50)
print(b)
#딕셔너리 연습
fruits = {"apple":100, "banana":200}
#검색
print(fruits["apple"])
#입력
fruits["kiwi"] = 300
print(fruits)
#수정
fruits["apple"] = 150 
print(fruits)
#삭제
del fruits["apple"]
print(fruits)
#반복문
for key, value in fruits.items():
    print(f"{key}, {value}")

#고객정보 저장
cust = {"name":"전우치", "age":30, "주소":"강남구 선릉역", 
    "직급":"프로"}
print(len(cust))
print(cust)

for item in cust.items():
    print(item)

#불변형식(int, float, str, bool, tuple)
a = 2.3 
print(id(a))
a = 3.5 
print(id(b))

#가변
lst = [1,2,3]
print(id(lst))
lst.append(20)
print(id(lst))