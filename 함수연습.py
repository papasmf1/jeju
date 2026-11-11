# 함수연습.py
# 함수는 입력값(매개변수)을 받아 작업한 뒤, 필요하면 결과를 호출한 곳으로 돌려준다.

# 두 매개변수 a와 b를 더한 값을 반환하는 함수
def add(a, b):
    # return은 덧셈 결과를 호출한 곳에 전달하고 함수 실행을 끝낸다.
    return a + b

# add를 호출하고 반환된 값을 result에 저장한다.
result = add(3, 5)
# result의 값을 화면에 출력한다.
print(result)

# 두 값을 반대 순서로 담아 반환하는 함수
def swap(x,y):
    # 쉼표로 구분한 반환값은 튜플 (y, x) 하나로 전달된다.
    return y, x

# 반환된 튜플 전체를 result에 저장한다.
result = swap(3, 5)
print(result)

# 값을 명시적으로 반환하지 않고 함수 내부에서만 값을 사용하는 함수
def setValue(newValue):
    # x는 함수 안에서 만들어진 지역 변수이므로 함수 바깥에서는 직접 사용할 수 없다.
    x = newValue
    print("함수 내부:", x)

# 반환문이 없는 함수의 호출 결과는 기본적으로 None이다.
result = setValue(10)
# 따라서 함수 내부에서 출력한 값과 달리, 여기서는 None이 출력된다.
print("함수 외부:", result)

# 두 문자열에 공통으로 포함된 문자를, 첫 번째 문자열의 순서대로 반환하는 함수
def intersection(prelist, postlist):
    result = []
    for x in prelist:
        if x in postlist and x not in result:
            result.append(x)
    return result


print(intersection("HAM","SPAM"))
